import 'server-only';
import { db } from './db';
import { chainStatus } from './provenance';
export async function internalMetrics() {
  const [
    collectors,
    wallets,
    squigs,
    currentOwnerships,
    discoveries,
    refresh,
    cursors,
    stale,
  ] = await Promise.all([
    db().collector.count(),
    db().collectorWallet.count({ where: { status: 'ACTIVE' } }),
    db().squig.count(),
    db().squigOwnership.count({ where: { isCurrent: true } }),
    db().squigDiscovery.count({ where: { everOwned: true } }),
    db().ownershipRefresh.findUnique({
      where: { id: 'squigs' },
      select: {
        status: true,
        nextToken: true,
        completedAt: true,
        errorCode: true,
        blockNumber: true,
      },
    }),
    db().chainCursor.findMany({
      select: { key: true, blockNumber: true, updatedAt: true },
    }),
    db().$queryRaw<
      { count: bigint }[]
    >`SELECT count(DISTINCT w."collectorId") AS count FROM "CollectorWallet" w JOIN "SquigOwnership" o ON o."walletAddress"=w."walletAddress" WHERE w.status='ACTIVE' AND w."chainId"=1 AND o."isCurrent"=true AND o."observedAt" < now()-interval '24 hours'`,
  ]);
  return {
    activity: {
      sources: await db().integrationSource.findMany(),
      events: await db().collectorActivity.groupBy({
        by: ['sourceType', 'attributionStatus', 'recordStatus'],
        _count: { _all: true },
      }),
      rejectedRecords: await db().importRejection.count({
        where: { resolvedAt: null },
      }),
      pendingAttributionJobs: await db().activityAttributionJob.count(),
      recentRuns: await db().syncRun.findMany({
        orderBy: { startedAt: 'desc' },
        take: 20,
      }),
    },
    provenance: await chainStatus(),
    collectors,
    wallets,
    squigs,
    currentOwnerships,
    discoveries,
    refresh: refresh
      ? { ...refresh, blockNumber: refresh.blockNumber?.toString() ?? null }
      : null,
    cursors: cursors.map((c) => ({
      ...c,
      blockNumber: c.blockNumber.toString(),
    })),
    collectionsWithOwnershipOlderThan24h: Number(stale[0].count),
  };
}
