import 'server-only';
import { Pool } from 'pg';
import { db } from '@/server/db';
import { readEnv } from '@/server/env';
import { log } from '@/server/log';
import { validateContract, squigsAbi } from '@/integrations/blockchain';
import {
  normalizeWallet,
  squigToken,
  SQUIGS_CONTRACT,
} from '@/domain/validation';
import { retryRpc, mapLimited } from '@/domain/provenance';
import { chainKey, derivePending, seedAttributions } from './provenance';
import type { Prisma } from '@/generated/prisma/client';

export type ChainReader = Awaited<ReturnType<typeof validateContract>>;
export async function chainLock<T>(run: () => Promise<T>) {
  const pool = new Pool({
    connectionString: readEnv().DATABASE_URL,
    max: 1,
    connectionTimeoutMillis: 5000,
  });
  const client = await pool.connect().catch(async (error) => {
    await pool.end();
    throw error;
  });
  try {
    const result = await client.query<{ locked: boolean }>(
      'SELECT pg_try_advisory_lock(hashtextextended($1,0)) AS locked',
      [chainKey],
    );
    if (!result.rows[0].locked) return null;
    try {
      return await run();
    } finally {
      await client.query('SELECT pg_advisory_unlock(hashtextextended($1,0))', [
        chainKey,
      ]);
    }
  } finally {
    client.release();
    await pool.end();
  }
}
export async function rewindFrom(tx: Prisma.TransactionClient, from: bigint) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('ownership-refresh',0))`;
  const affected = await tx.nftTransfer.findMany({
    where: { blockNumber: { gte: from } },
    select: { squigId: true },
    distinct: ['squigId'],
  });
  const snapshots = await tx.squigOwnership.findMany({
    where: { blockNumber: { gte: from } },
    select: { squigId: true },
    distinct: ['squigId'],
  });
  const ids = [
    ...new Set([...affected, ...snapshots].map((r) => r.squigId)),
  ].sort();
  for (const id of ids)
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${id},0))`;
  await tx.nftTransfer.deleteMany({ where: { blockNumber: { gte: from } } });
  await tx.chainBlock.deleteMany({
    where: { chainId: 1, number: { gte: from } },
  });
  const removedObservations = await tx.squigOwnership.findMany({
    where: { blockNumber: { gte: from } },
    select: { sourceKey: true },
  });
  await tx.squigDiscovery.updateMany({
    where: {
      sourceKey: { in: removedObservations.map((r) => r.sourceKey) },
      attributionStatus: 'OBSERVED',
    },
    data: { everOwned: false, attributionStatus: 'INVALIDATED' },
  });
  await tx.squigOwnership.deleteMany({ where: { blockNumber: { gte: from } } });
  // Legacy Phase 0 passport projections are not a canonical ledger.
  await tx.squigPassportEvent.deleteMany({
    where: { squigId: { in: ids }, sourceSystem: 'blockchain' },
  });
  await tx.squigProvenance.updateMany({
    where: { squigId: { in: ids } },
    data: { dirty: true, complete: false, ownerMatches: null },
  });
  await tx.ownershipRefresh.updateMany({
    where: { blockNumber: { gte: from } },
    data: {
      status: 'QUEUED',
      nextToken: 1,
      blockNumber: null,
      blockHash: null,
      blockTime: null,
      leaseToken: null,
      leaseUntil: null,
    },
  });
  return ids.length;
}
export async function transferBatch(reader?: ChainReader) {
  return chainLock(async () => {
    const env = readEnv();
    const call = <T>(fn: () => Promise<T>) =>
      retryRpc(fn, env.RPC_RETRIES, undefined, () => log('chain.rpc_retry'));
    const client = reader ?? (await call(validateContract));
    let cursor = await db().chainCursor.findUnique({
      where: { key: chainKey },
    });
    const finalized = await call(() =>
      client.getBlock({ blockTag: 'finalized' }),
    );
    let start = env.SQUIGS_START_BLOCK;
    if (start === undefined) throw new Error('START_BLOCK_REQUIRED');
    if (start > finalized.number) throw new Error('START_AFTER_FINALIZED');
    if (
      cursor?.startBlock !== null &&
      cursor?.startBlock !== undefined &&
      cursor.startBlock !== start
    )
      throw new Error('START_BLOCK_CHANGED');
    // Verify the configured boundary is exactly deployment, not an arbitrary partial start.
    if (!cursor?.startBlock) {
      const [at, before] = await Promise.all([
        call(() =>
          client.getCode({ address: SQUIGS_CONTRACT, blockNumber: start }),
        ),
        start > 0n
          ? call(() =>
              client.getCode({
                address: SQUIGS_CONTRACT,
                blockNumber: start! - 1n,
              }),
            )
          : undefined,
      ]);
      if (!at || at === '0x' || (before && before !== '0x'))
        throw new Error('DEPLOYMENT_BOUNDARY_INVALID');
      // Phase 0 cursor lacks raw ledger coverage. Restart new ledger from deployment.
      const priorNumber = start > 0n ? start - 1n : 0n;
      const prior = await call(() =>
        client.getBlock({ blockNumber: priorNumber }),
      );
      cursor = await db().chainCursor.upsert({
        where: { key: chainKey },
        create: {
          key: chainKey,
          startBlock: start,
          blockNumber: start - 1n,
          blockHash: prior.hash,
        },
        update: {
          startBlock: start,
          blockNumber: start - 1n,
          blockHash: prior.hash,
        },
      });
    }
    start = cursor!.startBlock!;
    try {
      const floor = cursor!.blockNumber - BigInt(env.REORG_REWIND_BLOCKS) + 1n;
      const recent = await db().chainBlock.findMany({
        where: { chainId: 1, number: { gte: floor, lte: cursor!.blockNumber } },
        orderBy: { number: 'asc' },
      });
      if (
        cursor!.blockNumber >= start &&
        !recent.some((b) => b.number === cursor!.blockNumber)
      )
        recent.push({
          chainId: 1,
          number: cursor!.blockNumber,
          hash: cursor!.blockHash,
          timestamp: new Date(0),
        });
      const checks = await mapLimited(
        recent,
        env.RPC_CONCURRENCY,
        async (b) => ({
          b,
          live: await call(() => client.getBlock({ blockNumber: b.number })),
        }),
      );
      if (checks.some((c) => c.b.hash !== c.live.hash)) {
        const from = floor > start ? floor : start;
        const anchor = await call(() =>
          client.getBlock({ blockNumber: from > 0n ? from - 1n : 0n }),
        );
        const stored = await db().chainBlock.findUnique({
          where: { chainId_number: { chainId: 1, number: anchor.number } },
        });
        // A deep mismatch must be reviewed rather than declaring a bounded repair successful.
        if (from > start && (!stored || stored.hash !== anchor.hash))
          throw new Error('DEEP_REORG_REVIEW_REQUIRED');
        await db().$transaction(
          async (tx) => {
            const affected = await rewindFrom(tx, from);
            await tx.chainCursor.update({
              where: { key: chainKey },
              data: {
                blockNumber: from - 1n,
                blockHash: anchor.hash,
                lastError: 'REORG_RECOVERED',
              },
            });
            log('chain.rewind', { from: from.toString(), affected });
          },
          { timeout: 60000 },
        );
        cursor = await db().chainCursor.findUniqueOrThrow({
          where: { key: chainKey },
        });
      }
      if (cursor!.blockNumber > finalized.number)
        throw new Error('FINALIZED_HEIGHT_REGRESSED');
      const from = cursor!.blockNumber + 1n,
        to =
          from + BigInt(env.TRANSFER_BLOCK_BATCH) - 1n > finalized.number
            ? finalized.number
            : from + BigInt(env.TRANSFER_BLOCK_BATCH) - 1n;
      if (from <= to) {
        const events = await call(() =>
          client.getContractEvents({
            address: SQUIGS_CONTRACT,
            abi: squigsAbi,
            eventName: 'Transfer',
            fromBlock: from,
            toBlock: to,
            strict: true,
          }),
        );
        // Cache event blocks plus a contiguous safety window and each chunk boundary.
        const numbers = new Set(events.map((e) => e.blockNumber));
        numbers.add(to);
        const recentFrom = to - BigInt(env.REORG_REWIND_BLOCKS);
        // Persist a rewind anchor; event blocks and chunk ends are sufficient checkpoints
        // for finalized-only ingestion without 128 empty-block RPCs per historical chunk.
        if (recentFrom >= start) numbers.add(recentFrom);
        const cached = await db().chainBlock.findMany({
          where: { chainId: 1, number: { in: [...numbers] } },
        });
        const blocks = new Map(cached.map((b) => [b.number, b]));
        const missing = [...numbers].filter((n) => !blocks.has(n));
        for (const b of await mapLimited(missing, env.RPC_CONCURRENCY, (n) =>
          call(() => client.getBlock({ blockNumber: n })),
        ))
          blocks.set(b.number, {
            chainId: 1,
            number: b.number,
            hash: b.hash,
            timestamp: new Date(Number(b.timestamp) * 1000),
          });
        const boundary = await call(() => client.getBlock({ blockNumber: to }));
        if (blocks.get(to)!.hash !== boundary.hash)
          throw new Error('CHAIN_CHANGED_DURING_SCAN');
        for (const e of events)
          if (e.removed || blocks.get(e.blockNumber)?.hash !== e.blockHash)
            throw new Error('LOG_BLOCK_MISMATCH');
        await db().$transaction(
          async (tx) => {
            for (const b of blocks.values())
              await tx.chainBlock.upsert({
                where: { chainId_number: { chainId: 1, number: b.number } },
                create: b,
                update: {},
              });
            const priorBlock = await tx.chainBlock.findUnique({
              where: {
                chainId_number: { chainId: 1, number: cursor!.blockNumber },
              },
            });
            await tx.$executeRaw`SELECT "key" FROM "ChainCursor" WHERE "key"=${chainKey} FOR UPDATE`;
            const guard = await tx.chainCursor.findUniqueOrThrow({
              where: { key: chainKey },
            });
            if (
              guard.blockNumber !== cursor!.blockNumber ||
              guard.blockHash !== cursor!.blockHash
            )
              throw new Error('CURSOR_CHANGED');
            const tokenIds = [
              ...new Set(events.map((e) => squigToken(String(e.args.tokenId)))),
            ];
            const squigs = await tx.squig.findMany({
              where: {
                chainId: 1,
                contractAddress: SQUIGS_CONTRACT,
                tokenId: { in: tokenIds },
              },
            });
            if (squigs.length !== tokenIds.length)
              throw new Error('IMPORT_SQUIG_DATA_FIRST');
            for (const s of [...squigs].sort((a, b) =>
              a.id.localeCompare(b.id),
            ))
              await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${s.id},0))`;
            for (const e of events) {
              const s = squigs.find(
                (s) => s.tokenId === Number(e.args.tokenId),
              )!;
              const existing = await tx.nftTransfer.findUnique({
                where: { id: `1:${e.transactionHash}:${e.logIndex}` },
              });
              if (
                existing &&
                (existing.blockHash !== e.blockHash ||
                  existing.tokenId !== s.tokenId ||
                  existing.fromAddress !== normalizeWallet(e.args.from) ||
                  existing.toAddress !== normalizeWallet(e.args.to))
              )
                throw new Error('LEDGER_EVENT_CONFLICT');
              await tx.nftTransfer.upsert({
                where: { id: `1:${e.transactionHash}:${e.logIndex}` },
                create: {
                  id: `1:${e.transactionHash}:${e.logIndex}`,
                  chainId: 1,
                  contractAddress: SQUIGS_CONTRACT,
                  tokenId: s.tokenId,
                  squigId: s.id,
                  fromAddress: normalizeWallet(e.args.from),
                  toAddress: normalizeWallet(e.args.to),
                  transactionHash: e.transactionHash,
                  logIndex: e.logIndex,
                  transactionIndex: e.transactionIndex,
                  blockNumber: e.blockNumber,
                  blockHash: e.blockHash,
                  eventAt: blocks.get(e.blockNumber)!.timestamp,
                },
                update: {},
              });
            }
            for (const s of squigs)
              await tx.squigProvenance.upsert({
                where: { squigId: s.id },
                create: { squigId: s.id },
                update: { dirty: true },
              });
            // New proofs/revocations may become effective during empty chain ranges.
            const changed = await tx.historicalIdentityAttribution.findMany({
              where: {
                OR: [
                  {
                    effectiveFrom: {
                      gt: priorBlock?.timestamp ?? new Date(0),
                      lte: blocks.get(to)!.timestamp,
                    },
                  },
                  {
                    effectiveTo: {
                      gt: priorBlock?.timestamp ?? new Date(0),
                      lte: blocks.get(to)!.timestamp,
                    },
                  },
                ],
              },
              select: { walletAddress: true },
            });
            const held = await tx.walletOwnershipPeriod.findMany({
              where: {
                walletAddress: { in: changed.map((e) => e.walletAddress) },
                lostAt: null,
              },
              select: { squigId: true },
            });
            await tx.squigProvenance.updateMany({
              where: { squigId: { in: held.map((p) => p.squigId) } },
              data: { dirty: true },
            });
            await tx.chainCursor.update({
              where: { key: chainKey },
              data: {
                blockNumber: to,
                blockHash: boundary.hash,
                finalizedBlock: finalized.number,
                lastSuccessAt: new Date(),
                lastError: null,
              },
            });
          },
          { timeout: 60000 },
        );
        log('chain.chunk', {
          from: from.toString(),
          to: to.toString(),
          events: events.length,
          finalized: finalized.number.toString(),
        });
      } else
        await db().chainCursor.update({
          where: { key: chainKey },
          data: {
            finalizedBlock: finalized.number,
            lastSuccessAt: new Date(),
            lastError: null,
          },
        });
      await derivePending(100);
      return from <= to;
    } catch (error) {
      const message =
        error instanceof Error && /^[A-Z_]+$/.test(error.message)
          ? error.message
          : 'CHAIN_SYNC_FAILED';
      await db().chainCursor.update({
        where: { key: chainKey },
        data: { lastError: message },
      });
      log('chain.failed', { code: message });
      throw error;
    }
  }).catch(async (error) => {
    const code =
      error instanceof Error && /^[A-Z_]+$/.test(error.message)
        ? error.message
        : 'CHAIN_SYNC_FAILED';
    await db()
      .chainCursor.updateMany({
        where: { key: chainKey },
        data: { lastError: code },
      })
      .catch(() => undefined);
    throw error;
  });
}
export async function syncTransfers() {
  await seedAttributions();
  const before = await db().nftTransfer.count();
  while (await transferBatch()) {
    /* One durable, locked chunk at a time. */
  }
  while (await derivePending()) {
    /* Resume projections independently of RPC. */
  }
  const after = await db().nftTransfer.count();
  return {
    scanned: Math.max(0, after - before),
    inserted: Math.max(0, after - before),
    updated: 0,
    skipped: 0,
    failed: 0,
  };
}
