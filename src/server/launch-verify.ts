import 'server-only';
import { preflight } from './production';
import { db } from './db';
import { recordGate, launchReport } from './launch';
import { assertDeploymentBinding } from './deployment';
import { services, heartbeatState } from '@/domain/operations';
import { type GateKey } from '@/domain/launch';
import { chainKey } from '@/sync/provenance';
// Safe verification only: never starts a worker, import, replay or historical scan.
export async function verifyLaunch() {
  if (!process.env.DATABASE_URL) return launchReport();
  await assertDeploymentBinding();
  const checks = await preflight();
  for (const [key, names] of [
    ['DATABASE', ['database']],
    [
      'MIGRATIONS',
      ['migration.pending', 'migration.failed', 'migration.checksums'],
    ],
  ] as const) {
    const found = checks.filter((c) =>
      (names as readonly string[]).includes(c.name),
    );
    await recordGate(
      key,
      found.length === names.length && found.every((c) => c.status === 'PASS')
        ? 'VERIFIED'
        : 'FAILED',
      'Safe local database/migration checks',
      found,
    );
  }
  const controls = await db().workerControl.findMany();
  const beats = await db().workerHeartbeat.findMany({
    orderBy: { lastHeartbeat: 'desc' },
    take: 100,
  });
  const workers = services.map((service) => ({
    service,
    mode: controls.find((c) => c.service === service)?.mode ?? 'DISABLED',
    state: beats.find((b) => b.service === service),
  }));
  await recordGate(
    'WORKERS',
    workers.every(
      (w) =>
        w.mode === 'LIVE' &&
        w.state?.lastSuccessAt &&
        Date.now() - w.state.lastSuccessAt.getTime() < 300000 &&
        ['IDLE', 'RUNNING', 'READY', 'LOCKED_BY_PEER'].includes(
          heartbeatState(w.state.lastHeartbeat, w.state.state),
        ),
    )
      ? 'VERIFIED'
      : 'PENDING',
    'All four LIVE workers require fresh successful heartbeats',
    workers.map((w) => ({
      service: w.service,
      mode: w.mode,
      heartbeat: w.state?.lastHeartbeat ?? null,
    })),
  );
  const cursor = await db().chainCursor.findUnique({
    where: { key: chainKey },
  });
  const [mints, continuous] = await Promise.all([
    db().squigProvenance.count({
      where: { mintAt: { not: null }, dirty: false },
    }),
    db().squigProvenance.count({ where: { complete: true, dirty: false } }),
  ]);
  const caught =
    !!cursor &&
    !cursor.lastError &&
    cursor.finalizedBlock !== null &&
    cursor.blockNumber === cursor.finalizedBlock;
  for (const [key, count] of [
    ['MINT_COVERAGE', mints],
    ['OWNERSHIP_CONTINUITY', continuous],
  ] as const)
    await recordGate(
      key,
      caught && count === 4444 ? 'VERIFIED' : count ? 'PARTIAL' : 'PENDING',
      `${count}/4444; stored finalized boundary only`,
      { count, block: cursor?.blockNumber.toString() ?? null },
    );
  // Queue emptiness is necessary but is never itself proof that a replay/import ran.
  for (const [key, stage] of [
    ['ACTIVITY', 'activity'],
    ['PROGRESSION', 'progression'],
    ['COLLECTIONS', 'collections'],
  ] as const) {
    const completed = await db().productionStage.findUnique({
      where: { stage },
    });
    const prior = await db().launchGate.findUnique({ where: { key } });
    if (!prior)
      await recordGate(
        key,
        completed?.completedAt ? 'PARTIAL' : 'PENDING',
        'Stage checkpoint requires reviewed production evidence and replay proof',
        { completed: completed?.completedAt ?? null },
      );
  }
  const unresolved = await db().collectorActivity.count({
    where: { collectorId: null },
  });
  const jobs = await db().activityAttributionJob.count();
  const attributionGate = await db().launchGate.findUnique({
    where: { key: 'REATTRIBUTION' },
  });
  // Clearing operational backlog does not prove downstream reconciliation, but
  // must replace the stale degraded observation with a current pending one.
  if (jobs || !attributionGate || attributionGate.status === 'DEGRADED')
    await recordGate(
      'REATTRIBUTION',
      jobs ? 'DEGRADED' : 'PENDING',
      `${jobs} pending attribution jobs; ${unresolved} unattributed events excluded`,
      { jobs, unresolved },
    );
  return launchReport();
}

export async function validateSources() {
  await assertDeploymentBinding();
  const { inspectIntegrations } = await import('@/integrations/inspect');
  const { sourcePermissions, safeSourceRole } =
    await import('@/integrations/permissions');
  const { sourceSchema } = await import('@/integrations/source-schema');
  const { sourceStats } = await import('@/integrations/source-stats');
  const { tables } = await import('@/integrations/registry');
  const { feedKey } = await import('@/integrations/bridge-protocol');
  const mapping: Record<string, GateKey> = {
    links: 'WALLET_LINKS',
    uglybot: 'UGLYBOT',
    gauntlet: 'GAUNTLET',
    survival: 'SURVIVAL',
    submissions: 'IMAGE_SUBMIT',
  };
  const results = [];
  for (const report of await inspectIntegrations()) {
    const role = report.configured
      ? await sourcePermissions(report.integration)
      : null;
    const schema = sourceSchema(report).compatible;
    const status = !report.configured
      ? 'PENDING'
      : !schema || !role?.ok || !safeSourceRole(role.data[0])
        ? 'FAILED'
        : 'PARTIAL';
    const result = {
      integration: report.integration,
      status,
      schemaCompatible: schema,
      transport: report.transport,
      reachable: report.reachable,
      authenticated: report.authenticated,
      unavailableFeeds: sourceSchema(report).unavailable,
      readOnly:
        role?.ok && safeSourceRole(role.data[0])
          ? 'VERIFIED_READ_ONLY'
          : 'UNABLE_TO_VERIFY',
      limitation:
        'Catalog inspection cannot prove absence of every writable SECURITY DEFINER routine or inherited privilege; operator review required',
      tables: [] as {
        table: string;
        rows: string | null;
        earliest: string | null;
        latest: string | null;
        status: string;
      }[],
    };
    for (const table of report.tables) {
      if (!table.present || table.missingRequired.length) continue;
      const spec = Object.values(tables).find(
        (s) => s.integration === report.integration && s.table === table.table,
      )!;
      const count = await sourceStats(feedKey(spec));
      result.tables.push({
        table: table.table,
        rows: count.ok ? count.data[0].rows : null,
        earliest: count.ok ? count.data[0].earliest : null,
        latest: count.ok ? count.data[0].latest : null,
        status: count.ok ? 'VERIFIED' : 'PENDING',
      });
    }
    results.push(result);
    if (mapping[report.integration])
      await recordGate(
        mapping[report.integration],
        status,
        'Schema/role inspection; history completeness remains separately reviewed',
        result,
      );
  }
  return results;
}
