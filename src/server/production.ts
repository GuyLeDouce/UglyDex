import 'server-only';
import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { db } from './db';
import { readEnv } from './env';
import { services, heartbeatState, type Check } from '@/domain/operations';
import { SQUIGS_CONTRACT } from '@/domain/validation';
import { RULESET } from '@/domain/progression';
import { COLLECTION_RULESET } from '@/domain/dex';
import { chainKey } from '@/sync/provenance';

export async function migrationChecks(): Promise<Check[]> {
  const directory = join(process.cwd(), 'prisma/migrations');
  const names = (await readdir(directory, { withFileTypes: true }))
    .filter((f) => f.isDirectory())
    .map((f) => f.name)
    .sort();
  const rows = await db().$queryRaw<
    {
      migration_name: string;
      checksum: string;
      finished_at: Date | null;
      rolled_back_at: Date | null;
    }[]
  >`SELECT migration_name,checksum,finished_at,rolled_back_at FROM _prisma_migrations`;
  const pending = names.filter(
    (n) =>
      !rows.some(
        (r) => r.migration_name === n && r.finished_at && !r.rolled_back_at,
      ),
  );
  const failed = rows.filter((r) => !r.finished_at && !r.rolled_back_at);
  const changed: string[] = [];
  for (const name of names) {
    const hash = createHash('sha256')
      .update(await readFile(join(directory, name, 'migration.sql')))
      .digest('hex');
    if (
      rows.some(
        (r) =>
          r.migration_name === name &&
          r.finished_at &&
          !r.rolled_back_at &&
          r.checksum !== hash,
      )
    )
      changed.push(name);
  }
  const unknown = rows.filter(
    (r) =>
      r.finished_at && !r.rolled_back_at && !names.includes(r.migration_name),
  );
  return [
    {
      name: 'migration.pending',
      status: pending.length ? 'FAIL' : 'PASS',
      detail: pending.join(', ') || `${names.length} applied migrations`,
    },
    {
      name: 'migration.failed',
      status: failed.length ? 'FAIL' : 'PASS',
      detail:
        failed.map((r) => r.migration_name).join(', ') ||
        'No unfinished migrations',
    },
    {
      name: 'migration.checksums',
      status: changed.length || unknown.length ? 'FAIL' : 'PASS',
      detail:
        [...changed, ...unknown.map((r) => r.migration_name)].join(', ') ||
        'Applied SQL matches this release',
    },
  ];
}

export async function preflight(
  options: { external?: boolean; render?: boolean } = {},
): Promise<Check[]> {
  const checks: Check[] = [];
  let env: ReturnType<typeof readEnv>;
  try {
    env = readEnv();
    checks.push({
      name: 'environment',
      status: 'PASS',
      detail: 'Validated; values redacted',
    });
  } catch {
    return [
      {
        name: 'environment',
        status: 'FAIL',
        detail:
          'Invalid or missing environment; inspect configured variable names using the deployment guide',
      },
    ];
  }
  const add = (
    name: string,
    pass: boolean,
    detail: string,
    severity: 'WARN' | 'FAIL' = 'FAIL',
  ) => checks.push({ name, status: pass ? 'PASS' : severity, detail });
  add(
    'public.origin',
    new URL(env.PUBLIC_BASE_URL).protocol === 'https:' &&
      !['localhost', '127.0.0.1'].includes(
        new URL(env.PUBLIC_BASE_URL).hostname,
      ),
    'Canonical HTTPS public origin required',
  );
  add('auth.secret', !!env.AUTH_SECRET, 'Session signing secret configured');
  add(
    'auth.discord',
    !!(
      env.DISCORD_CLIENT_ID &&
      env.DISCORD_CLIENT_SECRET &&
      env.DISCORD_REDIRECT_URI
    ),
    'All three Discord OAuth variables required for admin login',
  );
  add(
    'auth.admin',
    !!env.ADMIN_DISCORD_IDS,
    'Admin allowlist configured; IDs are never printed',
  );
  try {
    await db().$queryRaw`SELECT 1`;
    add('database', true, 'Connected');
  } catch {
    add('database', false, 'Database unavailable');
    return checks;
  }
  try {
    checks.push(...(await migrationChecks()));
  } catch {
    add(
      'migrations',
      false,
      'Migration history unavailable; run db:migrate and investigate failed migrations',
    );
    return checks;
  }
  if (
    checks.some((c) => c.name.startsWith('migration.') && c.status === 'FAIL')
  )
    return checks;
  if (process.env.APP_ENV && process.env.APP_ENV !== 'development') {
    const { deploymentChecks } = await import('./deployment');
    checks.push(...(await deploymentChecks(process.env.APP_ENV === 'staging')));
  } else if (process.env.NODE_ENV === 'production' && !process.env.APP_ENV)
    add('deployment.identity', false, 'APP_ENV required for deployed services');
  const [catalog, progression, collections, controls, heartbeats, sources] =
    await Promise.all([
      db().squig.count({
        where: {
          chainId: 1,
          contractAddress: SQUIGS_CONTRACT,
          tokenId: { gte: 1, lte: 4444 },
          metadataSourceHash: { not: null },
        },
      }),
      db().progressionRuleset.findUnique({ where: { id: RULESET } }),
      db().collectionRuleset.findUnique({ where: { id: COLLECTION_RULESET } }),
      db().workerControl.findMany(),
      db().workerHeartbeat.findMany({
        orderBy: { lastHeartbeat: 'desc' },
        take: 50,
      }),
      db().integrationSource.findMany(),
    ]);
  add(
    'catalog',
    catalog === 4444,
    `${catalog}/4444 catalog records; production:backfill starts with catalog`,
    'WARN',
  );
  add(
    'rulesets',
    !!progression && !!collections,
    'Versioned progression and collection seeds; created during catalog stage',
    'WARN',
  );
  for (const service of services) {
    const mode =
      controls.find((c) => c.service === service)?.mode ?? 'DISABLED';
    const heartbeat = heartbeats.find((h) => h.service === service);
    checks.push({
      name: `worker.${service}`,
      status:
        mode === 'DISABLED' ||
        (heartbeat &&
          !['STALE', 'ERROR', 'STOPPED'].includes(
            heartbeatState(heartbeat.lastHeartbeat, heartbeat.state),
          ))
          ? 'PASS'
          : 'WARN',
      detail: `${mode}; ${heartbeat ? heartbeatState(heartbeat.lastHeartbeat, heartbeat.state) : 'not started'}`,
    });
  }
  add(
    'rpc.configured',
    !!env.ETH_RPC_URL,
    'RPC required before transfers or ownership verification',
    'WARN',
  );
  add(
    'chain.start',
    env.SQUIGS_START_BLOCK !== undefined,
    'Explicit deployment start block required before scanning',
    'WARN',
  );
  if (options.external && env.ETH_RPC_URL) {
    try {
      const { validateContract } = await import('@/integrations/blockchain');
      const client = await validateContract();
      add(
        'rpc.contract',
        true,
        'Ethereum mainnet / canonical ERC-721 verified',
      );
      if (env.SQUIGS_START_BLOCK !== undefined) {
        const at = await client.getCode({
          address: SQUIGS_CONTRACT,
          blockNumber: env.SQUIGS_START_BLOCK,
        });
        const before =
          env.SQUIGS_START_BLOCK > 0n
            ? await client.getCode({
                address: SQUIGS_CONTRACT,
                blockNumber: env.SQUIGS_START_BLOCK - 1n,
              })
            : undefined;
        add(
          'rpc.archive_start',
          !!at && at !== '0x' && (!before || before === '0x'),
          'Archive reads must identify the exact contract deployment boundary',
        );
      }
    } catch {
      add(
        'rpc.probe',
        false,
        'RPC unavailable, wrong chain/contract, or archive capability missing',
      );
    }
  }
  if (options.external) {
    const { inspectIntegrations } = await import('@/integrations/inspect');
    const { readExternal } = await import('@/integrations/read-only');
    for (const report of await inspectIntegrations()) {
      if (!report.configured) {
        add(
          `source.${report.integration}`,
          false,
          'Not configured; history remains unavailable',
          'WARN',
        );
        continue;
      }
      add(
        `source.${report.integration}`,
        report.status === 'connected' &&
          report.tables.every((t) => t.present && !t.missingRequired.length),
        'Read-only connectivity and expected source schema',
      );
      const permission = await readExternal<{ unsafe: boolean }>(
        report.integration,
        "SELECT (SELECT rolsuper FROM pg_roles WHERE rolname=current_user) OR EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' AND has_table_privilege(quote_ident(table_schema)||'.'||quote_ident(table_name),'INSERT,UPDATE,DELETE,TRUNCATE')) AS unsafe",
      );
      add(
        `source.${report.integration}.role`,
        permission.ok && permission.data[0]?.unsafe === false,
        'External role must not have write or superuser privileges',
      );
    }
  }
  for (const source of sources)
    if (source.warning)
      add(`source.${source.id}.warning`, false, source.warning, 'WARN');
  if (options.render) {
    try {
      const { renderShareSafe } = await import('./share-render');
      const rendered = await renderShareSafe(
        {
          title: 'UglyDex',
          eyebrow: 'RENDER CHECK',
          description: 'Production readiness',
          stats: [],
          badges: [],
          tokens: [],
          path: '/',
          indexable: false,
        },
        { ratio: 'landscape', template: 'clean' },
        {},
      );
      add(
        'renderer',
        rendered.bytes.length > 1000,
        'Server-side PNG and bundled font',
      );
      const { loadArtwork } = await import('./share-art');
      add(
        'artwork',
        !!(await loadArtwork(1)),
        'Canonical gateway raster fetch; fallback remains available',
        'WARN',
      );
    } catch {
      add('renderer', false, 'Image renderer failed');
    }
  }
  return checks;
}

export async function productionOverview() {
  const [
    checks,
    chain,
    provenance,
    sources,
    workers,
    controls,
    stages,
    runs,
    pendingIdentity,
    progressionJobs,
    collectionJobs,
    renders,
    rulesets,
  ] = await Promise.all([
    preflight(),
    db().chainCursor.findUnique({ where: { key: chainKey } }),
    db().squigProvenance.groupBy({ by: ['dirty', 'complete'], _count: true }),
    db().integrationSource.findMany({ orderBy: { id: 'asc' } }),
    db().workerHeartbeat.findMany({
      orderBy: { lastHeartbeat: 'desc' },
      take: 30,
    }),
    db().workerControl.findMany(),
    db().productionStage.findMany(),
    db().syncRun.findMany({
      orderBy: { startedAt: 'desc' },
      take: 20,
      select: {
        id: true,
        source: true,
        status: true,
        startedAt: true,
        finishedAt: true,
        errorCode: true,
      },
    }),
    db().identityReconciliation.count({ where: { status: 'PENDING' } }),
    db().progressionJob.groupBy({ by: ['errorCode'], _count: true }),
    db().collectionJob.groupBy({ by: ['errorCode'], _count: true }),
    db().shareRenderMetric.groupBy({
      by: ['status'],
      where: { createdAt: { gt: new Date(Date.now() - 86400000) } },
      _count: true,
    }),
    db().progressionRuleset.findMany({ select: { id: true, status: true } }),
  ]);
  const rawVersion =
    process.env.RAILWAY_GIT_COMMIT_SHA ?? process.env.APP_COMMIT ?? '';
  return {
    checks,
    chain,
    provenance,
    sources,
    workers,
    controls,
    stages,
    runs,
    pendingIdentity,
    progressionJobs,
    collectionJobs,
    renders,
    rulesets,
    version: /^[a-f0-9]{7,40}$/.test(rawVersion) ? rawVersion : 'Not supplied',
  };
}
