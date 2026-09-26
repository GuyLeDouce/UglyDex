import 'server-only';
import { parseAbi, type Address } from 'viem';
import { Pool } from 'pg';
import { db } from './db';
import { rpc } from '@/integrations/blockchain';
import { readEnv } from './env';
import {
  contractManifest,
  applyEditionEvents,
  type EditionEvent,
} from '@/domain/edition-history';
import { safeOperationalCode } from '@/domain/operations';
import { assertOperation, assertDeploymentBinding } from './deployment';
import { log } from './log';
const abi = parseAbi([
  'function supportsInterface(bytes4 interfaceId) view returns (bool)',
  'event Transfer(address indexed from,address indexed to,uint256 indexed tokenId)',
  'event TransferSingle(address indexed operator,address indexed from,address indexed to,uint256 id,uint256 value)',
  'event TransferBatch(address indexed operator,address indexed from,address indexed to,uint256[] ids,uint256[] values)',
]);
export async function registerEditionContract(
  input: unknown,
  actor: string,
  client = rpc(),
) {
  await assertOperation('editions');
  const m = contractManifest.parse(input),
    id = `${m.chainId}:${m.address}`;
  if ((await client.getChainId()) !== m.chainId) throw new Error('WRONG_CHAIN');
  const startBlock = BigInt(m.startBlock),
    address = m.address as Address;
  const [code, before, block, support] = await Promise.all([
    client.getCode({ address, blockNumber: startBlock }),
    client.getCode({ address, blockNumber: startBlock - 1n }),
    client.getBlock({ blockNumber: startBlock }),
    client.readContract({
      address,
      abi,
      functionName: 'supportsInterface',
      args: [m.standard === 'ERC721' ? '0x80ac58cd' : '0xd9b67a26'],
    }),
  ]);
  if (!code || code === '0x' || (before && before !== '0x') || !support)
    throw new Error('EDITION_CONTRACT_VERIFICATION_FAILED');
  return db().$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${id},0))`;
    const old = await tx.editionContract.findUnique({ where: { id } });
    if (old) throw new Error('REGISTRY_EXISTS_REVIEW_REQUIRED');
    const row = await tx.editionContract.create({
      data: {
        ...m,
        id,
        startBlock,
        status: 'VERIFIED',
        verifiedAt: new Date(),
        startHash: block.hash,
      },
    });
    await tx.operationalAudit.create({
      data: {
        actor,
        action: 'EDITION_CONTRACT_VERIFIED',
        subject: id,
        detail: {
          reference: m.sourceReference,
          standard: m.standard,
          startBlock: m.startBlock,
          tokenIds: m.tokenIds,
        },
      },
    });
    return row;
  });
}
export async function editionIndexBatch(id: string, client = rpc()) {
  const started = Date.now();
  const pool = new Pool({ connectionString: readEnv().DATABASE_URL, max: 1 }),
    lock = await pool.connect();
  try {
    if (
      !(
        await lock.query(
          'SELECT pg_try_advisory_lock(hashtextextended($1,0)) AS locked',
          [id],
        )
      ).rows[0].locked
    )
      return { events: 0, locked: true };
    let c = await db().editionContract.findUniqueOrThrow({ where: { id } });
    if (c.status !== 'VERIFIED' || !c.enabled)
      return { events: 0, disabled: true };
    await assertDeploymentBinding();
    if ((await client.getChainId()) !== c.chainId)
      throw new Error('WRONG_CHAIN');
    const address = c.address as Address;
    if (
      (await client.getBlock({ blockNumber: c.startBlock })).hash !==
      c.startHash
    )
      throw new Error('EDITION_START_REORG_REVIEW');
    const finalized = await client.getBlock({ blockTag: 'finalized' });
    if (c.cursor !== null && c.cursorHash) {
      const current = await client.getBlock({ blockNumber: c.cursor });
      if (current.hash !== c.cursorHash) {
        const points = await db().editionCheckpoint.findMany({
          where: { contractId: id },
          orderBy: { blockNumber: 'desc' },
          take: 32,
        });
        let anchor: (typeof points)[number] | undefined;
        for (const p of points)
          if (
            (await client.getBlock({ blockNumber: p.blockNumber })).hash ===
            p.blockHash
          ) {
            anchor = p;
            break;
          }
        if (
          !anchor &&
          c.cursor - c.startBlock > BigInt(readEnv().REORG_REWIND_BLOCKS)
        )
          throw new Error('EDITION_DEEP_REORG_REVIEW');
        const from = anchor ? anchor.blockNumber + 1n : c.startBlock;
        await db().$transaction(
          async (tx) => {
            const changed = await tx.editionTransfer.findMany({
              where: { contractId: id, blockNumber: { gte: from } },
              select: { tokenId: true },
              distinct: ['tokenId'],
            });
            await tx.editionTransfer.deleteMany({
              where: { contractId: id, blockNumber: { gte: from } },
            });
            await tx.editionCheckpoint.deleteMany({
              where: { contractId: id, blockNumber: { gte: from } },
            });
            for (const { tokenId } of changed) {
              const events = await tx.editionTransfer.findMany({
                where: { contractId: id, tokenId },
                orderBy: [
                  { blockNumber: 'asc' },
                  { logIndex: 'asc' },
                  { batchIndex: 'asc' },
                ],
                take: 50001,
              });
              if (events.length > 50000)
                throw new Error('EDITION_REPLAY_LIMIT_REVIEW');
              await tx.editionBalance.deleteMany({
                where: { contractId: id, tokenId },
              });
              const balances = applyEditionEvents(c.standard, [], events);
              if (balances.length)
                await tx.editionBalance.createMany({
                  data: balances.map((b) => ({
                    ...b,
                    contractId: id,
                    tokenId,
                  })),
                });
            }
            await tx.editionOwnership.deleteMany({
              where: {
                edition: { chainId: c.chainId, contractAddress: c.address },
              },
            });
            await tx.editionContract.update({
              where: { id },
              data: {
                cursor: anchor?.blockNumber ?? null,
                cursorHash: anchor?.blockHash ?? null,
                errorCode: 'REORG_RECOVERED',
              },
            });
            await tx.operationalAudit.create({
              data: {
                actor: 'edition-indexer',
                action: 'EDITION_REORG',
                subject: id,
                detail: { from: from.toString() },
              },
            });
          },
          { timeout: 60000 },
        );
        c = await db().editionContract.findUniqueOrThrow({ where: { id } });
      }
    }
    if (c.cursor !== null && c.cursor > finalized.number)
      throw new Error('FINALIZED_HEIGHT_REGRESSED');
    const from = (c.cursor ?? c.startBlock - 1n) + 1n,
      to =
        from + BigInt(readEnv().TRANSFER_BLOCK_BATCH) - 1n < finalized.number
          ? from + BigInt(readEnv().TRANSFER_BLOCK_BATCH) - 1n
          : finalized.number;
    if (from > to) {
      await db().editionContract.update({
        where: { id },
        data: {
          finalizedBlock: finalized.number,
          lastSuccessAt: new Date(),
          errorCode: null,
        },
      });
      return { events: 0, caughtUp: true };
    }
    const logs = await client.getContractEvents({
      address,
      abi,
      fromBlock: from,
      toBlock: to,
      strict: true,
    });
    if (logs.length > 10000) throw new Error('EDITION_BATCH_TOO_LARGE');
    const boundary = await client.getBlock({ blockNumber: to });
    const blocks = new Map<bigint, { hash: string; timestamp: bigint }>([
      [to, boundary],
    ]);
    for (const number of new Set(logs.map((e) => e.blockNumber)))
      if (!blocks.has(number))
        blocks.set(number, await client.getBlock({ blockNumber: number }));
    const events: (EditionEvent & {
      contractId: string;
      blockNumber: bigint;
      blockHash: string;
      transactionHash: string;
      logIndex: number;
      batchIndex: number;
    })[] = [];
    for (const e of logs) {
      if (
        e.blockNumber < from ||
        e.blockNumber > to ||
        e.removed ||
        blocks.get(e.blockNumber)?.hash !== e.blockHash
      )
        throw new Error('EDITION_LOG_BLOCK_MISMATCH');
      if (
        (c.standard === 'ERC721' && e.eventName !== 'Transfer') ||
        (c.standard === 'ERC1155' && e.eventName === 'Transfer')
      )
        continue;
      const ids =
        e.eventName === 'Transfer'
          ? [e.args.tokenId]
          : e.eventName === 'TransferSingle'
            ? [e.args.id]
            : e.args.ids;
      const values =
        e.eventName === 'Transfer'
          ? [1n]
          : e.eventName === 'TransferSingle'
            ? [e.args.value]
            : e.args.values;
      if (ids.length !== values.length || ids.length > 1000)
        throw new Error('EDITION_BATCH_INVALID');
      ids.forEach((token, index) => {
        if (c.tokenIds.includes(token.toString()))
          events.push({
            id: `${id}:${e.transactionHash}:${e.logIndex}:${index}`,
            contractId: id,
            tokenId: token.toString(),
            quantity: values[index].toString(),
            fromAddress: e.args.from.toLowerCase(),
            toAddress: e.args.to.toLowerCase(),
            blockNumber: e.blockNumber,
            blockHash: e.blockHash,
            transactionHash: e.transactionHash,
            logIndex: e.logIndex,
            batchIndex: index,
            eventAt: new Date(
              Number(blocks.get(e.blockNumber)!.timestamp) * 1000,
            ),
          });
      });
    }
    events.sort((a, b) =>
      a.blockNumber < b.blockNumber
        ? -1
        : a.blockNumber > b.blockNumber
          ? 1
          : a.logIndex - b.logIndex || a.batchIndex - b.batchIndex,
    );
    if ((await client.getBlock({ blockNumber: to })).hash !== boundary.hash)
      throw new Error('EDITION_CHAIN_CHANGED');
    await db().$transaction(
      async (tx) => {
        const fresh = await tx.editionContract.findUniqueOrThrow({
          where: { id },
        });
        if (
          !fresh.enabled ||
          fresh.revision !== c.revision ||
          fresh.cursor !== c.cursor
        )
          throw new Error('EDITION_CONTROL_CHANGED');
        for (const tokenId of new Set(events.map((e) => e.tokenId))) {
          const previous = await tx.editionBalance.findMany({
            where: { contractId: id, tokenId },
          });
          const balances = applyEditionEvents(
            c.standard,
            previous,
            events.filter((e) => e.tokenId === tokenId),
          );
          for (const b of balances)
            await tx.editionBalance.upsert({
              where: {
                contractId_tokenId_walletAddress: {
                  contractId: id,
                  tokenId,
                  walletAddress: b.walletAddress,
                },
              },
              create: { ...b, contractId: id, tokenId },
              update: b,
            });
        }
        if (events.length)
          await tx.editionTransfer.createMany({ data: events });
        await tx.editionCheckpoint.create({
          data: { contractId: id, blockNumber: to, blockHash: boundary.hash },
        });
        await tx.editionContract.update({
          where: { id },
          data: {
            cursor: to,
            cursorHash: boundary.hash,
            finalizedBlock: finalized.number,
            lastSuccessAt: new Date(),
            errorCode: null,
          },
        });
      },
      { timeout: 60000 },
    );
    log('edition.batch', {
      service: 'editions',
      stage: id,
      events: events.length,
      durationMs: Date.now() - started,
      success: true,
      cursor: to.toString(),
      rssBytes: process.memoryUsage().rss,
    });
    return { events: events.length, cursor: to.toString() };
  } catch (error) {
    const code = safeOperationalCode(error);
    await db().editionContract.updateMany({
      where: { id },
      data: { errorCode: code, enabled: false },
    });
    await db().operationalAudit.create({
      data: {
        actor: 'edition-indexer',
        action: 'EDITION_HALTED',
        subject: id,
        detail: { code },
      },
    });
    throw error;
  } finally {
    await lock.query('SELECT pg_advisory_unlock_all()').catch(() => {});
    lock.release();
    await pool.end();
  }
}
