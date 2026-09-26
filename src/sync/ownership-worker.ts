import 'server-only';
import { randomUUID } from 'node:crypto';
import { db } from '@/server/db';
import { validateContract, getOwnershipBatch } from '@/integrations/blockchain';
import { normalizeWallet, SQUIGS_CONTRACT } from '@/domain/validation';
import { observe } from './blockchain';
import { log } from '@/server/log';
// Every batch is lease-fenced. RPC calls happen outside transactions, writes and
// the checkpoint commit together. An interrupted batch can always be replayed.
export async function ownershipWorkerBatch(
  dependencies = { validateContract, getOwnershipBatch },
) {
  const leaseToken = randomUUID();
  const claimed = await db().$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('ownership-refresh',0))`;
    return tx.ownershipRefresh.updateMany({
      where: {
        id: 'squigs',
        OR: [
          { status: 'QUEUED' },
          { status: 'SYNCING', leaseUntil: { lt: new Date() } },
        ],
      },
      data: {
        status: 'SYNCING',
        leaseToken,
        leaseUntil: new Date(Date.now() + 180000),
        startedAt: new Date(),
      },
    });
  });
  if (!claimed.count) return false;
  try {
    let job = await db().ownershipRefresh.findUniqueOrThrow({
      where: { id: 'squigs' },
    });
    const client = await dependencies.validateContract();
    const block = await client.getBlock(
      job.blockNumber !== null
        ? { blockNumber: job.blockNumber }
        : { blockTag: 'finalized' },
    );
    if (job.blockHash && job.blockHash !== block.hash)
      throw new Error('FINALIZED_REORG_REVIEW_REQUIRED');
    if (job.blockNumber === null) {
      await db().ownershipRefresh.updateMany({
        where: { id: 'squigs', leaseToken },
        data: {
          blockNumber: block.number,
          blockHash: block.hash,
          blockTime: new Date(Number(block.timestamp) * 1000),
        },
      });
      job = await db().ownershipRefresh.findUniqueOrThrow({
        where: { id: 'squigs' },
      });
    }
    const tokens = Array.from(
      { length: Math.min(100, 4445 - job.nextToken) },
      (_, i) => job.nextToken + i,
    );
    const results = await dependencies.getOwnershipBatch(
      client,
      tokens,
      block.number,
    );
    if (results.some((r) => r.status !== 'success'))
      throw new Error('RPC_BATCH_INCOMPLETE');
    const counts = await db().$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('ownership-refresh',0))`;
        const owned = await tx.ownershipRefresh.findUniqueOrThrow({
          where: { id: 'squigs' },
        });
        if (owned.leaseToken !== leaseToken || owned.leaseUntil! < new Date())
          throw new Error('LEASE_LOST');
        const counts = {
          scanned: 0,
          inserted: 0,
          updated: 0,
          skipped: 0,
          failed: 0,
        };
        for (let i = 0; i < tokens.length; i++) {
          const result = results[i];
          if (result.status !== 'success')
            throw new Error('RPC_BATCH_INCOMPLETE');
          const outcome = await observe(tx, {
            tokenId: tokens[i],
            wallet: normalizeWallet(result.result),
            block: block.number,
            blockHash: block.hash,
            time: new Date(Number(block.timestamp) * 1000),
            key: `owner:1:${SQUIGS_CONTRACT}:${tokens[i]}:${block.number}`,
            source: 'ownerOf',
          });
          counts.scanned++;
          counts[outcome]++;
        }
        const next = job.nextToken + tokens.length,
          complete = next > 4444;
        await tx.ownershipRefresh.update({
          where: { id: 'squigs' },
          data: {
            nextToken: next,
            status: complete ? 'COMPLETE' : 'QUEUED',
            leaseToken: null,
            leaseUntil: null,
            errorCode: null,
            ...(complete ? { completedAt: new Date() } : {}),
          },
        });
        return counts;
      },
      { timeout: 60000 },
    );
    log('ownership.batch', {
      ...counts,
      throughToken: tokens.at(-1) ?? null,
      block: block.number.toString(),
    });
    return true;
  } catch (error) {
    const code =
      error instanceof Error &&
      error.message === 'FINALIZED_REORG_REVIEW_REQUIRED'
        ? 'FINALIZED_REORG_REVIEW_REQUIRED'
        : 'RPC_OR_DATABASE_FAILURE';
    await db().ownershipRefresh.updateMany({
      where: { id: 'squigs', leaseToken },
      data: {
        status: 'FAILED',
        errorCode: code,
        leaseToken: null,
        leaseUntil: null,
      },
    });
    log('ownership.failed', { code, failed: 1 });
    return false;
  }
}
