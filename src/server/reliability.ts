import 'server-only';
import { db } from './db';
import { services } from '@/domain/operations';
import { subsystemStatus, type ServiceStatus } from '@/domain/reliability';
import { chainKey } from '@/sync/provenance';
import { localHealth } from './operational-metrics';
export async function reliabilityReport() {
  const now = Date.now();
  const [
    controls,
    beats,
    chain,
    sources,
    rejected,
    identity,
    progression,
    collections,
    renders,
    contracts,
    incidents,
    anomalies,
  ] = await Promise.all([
    db().workerControl.findMany(),
    db().workerHeartbeat.findMany({
      orderBy: { lastHeartbeat: 'desc' },
      take: 100,
    }),
    db().chainCursor.findUnique({ where: { key: chainKey } }),
    db().integrationSource.findMany(),
    db().importRejection.count({ where: { resolvedAt: null } }),
    db().identityReconciliation.count({ where: { status: 'PENDING' } }),
    db().progressionJob.count({ where: { errorCode: { not: null } } }),
    db().collectionJob.count({ where: { errorCode: { not: null } } }),
    db().shareRenderMetric.groupBy({
      by: ['status'],
      where: { createdAt: { gt: new Date(now - 3600000) } },
      _count: true,
    }),
    db().editionContract.findMany({ take: 100, orderBy: { id: 'asc' } }),
    db().operationalAudit.findMany({
      where: {
        action: {
          in: [
            'CIRCUIT_OPEN',
            'EDITION_HALTED',
            'EDITION_REORG',
            'STAGE_GATE',
            'DEPLOYMENT',
          ],
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: { action: true, subject: true, createdAt: true },
    }),
    db().squigProvenance.count({ where: { complete: false } }),
  ]);
  const systems: { name: string; status: ServiceStatus; detail: string }[] = [];
  const verifiedCustoms = await db().squigCustom.count({
    where: { status: 'VERIFIED' },
  });
  const invalidCustoms = await db().squigCustom.count({
    where: { status: 'VERIFIED', verifiedAt: null },
  });
  systems.push({
    name: 'Customs catalog',
    status: invalidCustoms
      ? 'FAILED'
      : verifiedCustoms
        ? 'HEALTHY'
        : 'DISABLED',
    detail: `${verifiedCustoms} verified records; ${invalidCustoms} missing approvals; live artwork validity requires collectibles:verify`,
  });
  const metrics = await db().operationalMetric.findMany({
    where: { bucket: { gte: new Date(now - 3600000) } },
  });
  const health = localHealth(),
    webErrors = metrics
      .filter((m) => m.kind === 'WEB_ERROR')
      .reduce((n, m) => n + m.count, 0),
    dbErrors = metrics
      .filter((m) => m.kind === 'DATABASE_FAILURE')
      .reduce((n, m) => n + m.count, 0);
  systems.push({
    name: 'Web',
    status: webErrors
      ? 'DEGRADED'
      : health.healthSuccessAt && now - health.healthSuccessAt < 300000
        ? 'HEALTHY'
        : 'DEGRADED',
    detail: `${webErrors} recorded errors in hourly windows; health observation ${health.healthSuccessAt ? new Date(health.healthSuccessAt).toISOString() : 'unobserved in this process'}`,
  });
  systems.push({
    name: 'Database',
    status: dbErrors || health.databaseFailures ? 'DEGRADED' : 'HEALTHY',
    detail: `Admin queries connected; ${dbErrors} persisted failures, ${health.databaseFailures} process-local failures; platform logs required across outages/restarts`,
  });
  for (const service of services) {
    const mode =
        controls.find((c) => c.service === service)?.mode ?? 'DISABLED',
      beat = beats.find((b) => b.service === service);
    const age = beat ? now - beat.lastHeartbeat.getTime() : undefined;
    systems.push({
      name: service,
      status: subsystemStatus({
        enabled: mode !== 'DISABLED',
        failed: mode !== 'DISABLED' && !!beat?.errorCode,
        observed:
          !!beat && ['RUNNING', 'IDLE', 'LOCKED_BY_PEER'].includes(beat.state),
        ageMs: age,
      }),
      detail: `${mode}; heartbeat age ${age === undefined ? 'unobserved' : Math.round(age / 1000) + 's'}`,
    });
  }
  const lag =
    chain?.finalizedBlock !== null && chain?.finalizedBlock !== undefined
      ? chain.finalizedBlock - chain.blockNumber
      : undefined;
  systems.push({
    name: 'Reloaded index',
    status: subsystemStatus({
      enabled: !!chain,
      failed: !!chain?.lastError,
      observed: !!chain?.lastSuccessAt,
      ageMs: chain?.lastSuccessAt
        ? now - chain.lastSuccessAt.getTime()
        : undefined,
      maxAgeMs: 300000,
      lag,
    }),
    detail: `Finalized lag ${lag?.toString() ?? 'unknown'} blocks; ${anomalies} incomplete/anomalous token histories`,
  });
  systems.push({
    name: 'Legacy integrations',
    status: sources.some((s) => s.state === 'ERROR')
      ? 'FAILED'
      : !sources.length
        ? 'DISABLED'
        : sources.some(
              (s) =>
                !s.backfillFinishedAt ||
                !s.schemaValid ||
                !s.lastSuccessAt ||
                now - s.lastSuccessAt.getTime() > 900000,
            )
          ? 'DEGRADED'
          : 'HEALTHY',
    detail: `${sources.length} configured observations; ${rejected} unresolved rejected records`,
  });
  const failedRenders = renders
      .filter((r) => !['OK', 'CACHE_HIT'].includes(r.status))
      .reduce((n, r) => n + r._count, 0),
    total = renders.reduce((n, r) => n + r._count, 0);
  systems.push({
    name: 'Sharing',
    status: !total
      ? 'DEGRADED'
      : failedRenders / total > 0.05
        ? 'FAILED'
        : failedRenders
          ? 'DEGRADED'
          : 'HEALTHY',
    detail: `${failedRenders}/${total} failed/fallback renders in last hour; no observations is not healthy`,
  });
  for (const c of contracts)
    systems.push({
      name: `Edition ${c.address}`,
      status: subsystemStatus({
        enabled: c.enabled,
        failed: !!c.errorCode,
        observed: !!c.lastSuccessAt,
        ageMs: c.lastSuccessAt ? now - c.lastSuccessAt.getTime() : undefined,
        maxAgeMs: 300000,
        lag:
          c.finalizedBlock !== null && c.cursor !== null
            ? c.finalizedBlock - c.cursor
            : undefined,
      }),
      detail: `${c.standard}; ${c.errorCode ?? 'no recorded error'}; indexed ${c.cursor?.toString() ?? 'not started'}`,
    });
  return {
    systems,
    alerts: systems.filter((s) => ['FAILED', 'DEGRADED'].includes(s.status)),
    quality: {
      rejected,
      unresolvedIdentity: identity,
      failedProgression: progression,
      failedCollections: collections,
      provenanceAnomalies: anomalies,
    },
    incidents,
  };
}
