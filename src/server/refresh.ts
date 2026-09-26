import 'server-only';
import { db } from './db';
export const REFRESH_INTERVAL_MS = 10 * 60 * 1000;
export function canRefresh(last: Date | null, now = new Date()) {
  return !last || now.getTime() - last.getTime() >= REFRESH_INTERVAL_MS;
}
export async function requestRefresh(collectorId: string) {
  return db().$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('ownership-refresh',0))`;
    const last = await tx.collectorRefreshRequest.findUnique({
      where: { collectorId },
    });
    if (!canRefresh(last?.requestedAt ?? null))
      throw new Error('REFRESH_THROTTLED');
    await tx.collectorRefreshRequest.upsert({
      where: { collectorId },
      create: { collectorId },
      update: { requestedAt: new Date() },
    });
    const old = await tx.ownershipRefresh.findUnique({
      where: { id: 'squigs' },
    });
    if (old && ['QUEUED', 'SYNCING'].includes(old.status))
      return { status: old.status };
    // Coalesce requests across collectors. A failed scan keeps its finalized snapshot/checkpoint.
    if (old?.status === 'COMPLETE' && !canRefresh(old.completedAt))
      return { status: 'COMPLETE' };
    await tx.ownershipRefresh.upsert({
      where: { id: 'squigs' },
      create: { id: 'squigs' },
      update: {
        status: 'QUEUED',
        errorCode: null,
        requestedAt: new Date(),
        ...(old?.status === 'FAILED'
          ? {}
          : {
              nextToken: 1,
              blockNumber: null,
              blockHash: null,
              blockTime: null,
            }),
      },
    });
    return { status: 'QUEUED' };
  });
}
export async function refreshStatus() {
  const r = await db().ownershipRefresh.findUnique({ where: { id: 'squigs' } });
  return {
    status: r?.status ?? 'NOT_SYNCED',
    updatedAt: r?.completedAt?.toISOString() ?? null,
    processed: r ? Math.min(r.nextToken - 1, 4444) : 0,
  };
}
