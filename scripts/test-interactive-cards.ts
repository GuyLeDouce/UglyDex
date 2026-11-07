// No dotenv, no TEST_DATABASE_URL and no caller-selected database. Every run owns a
// new loopback PostgreSQL cluster with random credentials and a generated UUID.
import { fixturePostgres } from './test-postgres';
import { randomBytes, randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { resolve, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdir, rm } from 'node:fs/promises';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import assert from 'node:assert/strict';
import { integrationEnv } from '../src/integrations/registry';
async function unusedPort() {
  const server = createServer();
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const port = (server.address() as { port: number }).port;
  await new Promise<void>((r) => server.close(() => r()));
  return port;
}
// Removable Windows worktrees can take longer than the application connection
// deadline to open PostgreSQL's backend files. Keep disposable cluster I/O on
// the local temporary disk; screenshots and test evidence remain in .data.
const root =
    process.platform === 'win32'
      ? resolve(tmpdir(), 'uglydex-db-fixtures')
      : resolve('.data'),
  directory = resolve(root, `test-${randomUUID()}`);
if (relative(root, directory).startsWith('..') || directory === root)
  throw new Error('UNSAFE_TEST_DIRECTORY');
const port = await unusedPort(),
  webPort = await unusedPort(),
  password = randomBytes(24).toString('hex');
console.log(JSON.stringify({ event: 'test.prepare_postgres_runtime' }));
const EmbeddedPostgres = await fixturePostgres(directory);
const postgres = new EmbeddedPostgres({
  databaseDir: resolve(directory, 'cluster'),
  user: 'uglydex_test',
  password,
  port,
  // Own cleanup below adds bounded Windows handle-release retries.
  persistent: true,
  // PG18 async I/O workers can outlive taskkill on Windows and retain pipes.
  // Synchronous I/O keeps this disposable fixture's shutdown deterministic.
  postgresFlags: ['-h', '127.0.0.1', '-k', '', '-c', 'io_method=sync'],
  onLog: () => {},
  onError: () => {},
});
// Keep blank values present so Next/Prisma dotenv loading cannot fill these from
// a developer's real .env file in child processes.
for (const key of Object.values(integrationEnv)) process.env[key] = '';
for (const key of [
  'DISCORD_CLIENT_ID',
  'DISCORD_CLIENT_SECRET',
  'DISCORD_REDIRECT_URI',
  'ETH_RPC_URL',
  'OPENSEA_API_KEY',
  'ECOSYSTEM_GUILD_ID',
  'SQUIG_IMAGE_BASE_URL',
  'ARTWORK_S3_ENDPOINT',
  'ARTWORK_S3_BUCKET',
  'ARTWORK_S3_ACCESS_KEY_ID',
  'ARTWORK_S3_SECRET_ACCESS_KEY',
  'ARTWORK_WARM_ON_START',
  'UGLYBOT_BRIDGE_URL',
  'UGLYBOT_BRIDGE_SECRET',
  'UGLYBOT_BOT_DISCORD_ID',
  'GAUNTLET_BRIDGE_URL',
  'GAUNTLET_BRIDGE_SECRET',
  'IMAGE_BRIDGE_URL',
  'IMAGE_BRIDGE_SECRET',
  'DRIP_READ_API_KEY',
  'DRIP_REALM_ID',
  'DRIP_REALM_POINT_ID',
  'DRIP_MAX_RPM',
  'DRIP_SYNC_INTERVAL_MS',
  'DRIP_STALE_AFTER_MS',
  'CHARM_DIRTY_UGLYBOT_SECRET',
  'CHARM_DIRTY_GAUNTLET_SECRET',
])
  process.env[key] = '';
process.env.SQUIGS_CONTRACT_ADDRESS =
  '0x8c9a02c0585200c4c65608df6b8def543d33792a';
process.env.DATABASE_URL = `postgresql://uglydex_test:${password}@127.0.0.1:${port}/uglydex_test`;
Object.assign(process.env, { NODE_ENV: 'test', APP_ENV: 'development' });
if (true) {
  // These are synthetic loopback-fixture values. Web pages read cached database
  // snapshots and enqueue hints; no DRIP worker or upstream request is started.
  Object.assign(process.env, {
    DRIP_READ_API_KEY: 'fixture-key-never-public',
    DRIP_REALM_ID: 'a'.repeat(24),
    DRIP_REALM_POINT_ID: 'b'.repeat(24),
  });
}
Object.assign(process.env, {
  DRIP_MAX_RPM: '6',
  DRIP_SYNC_INTERVAL_MS: '1800000',
  DRIP_STALE_AFTER_MS: '300000',
  DRIP_SWEEP_PAUSED: 'false',
});
process.env.PUBLIC_BASE_URL = `https://localhost:${webPort}`;
process.env.AUTH_SECRET = randomBytes(32).toString('hex');
process.env.ADMIN_DIAGNOSTICS_TOKEN = randomBytes(32).toString('hex');
process.env.ADMIN_DISCORD_IDS = '333333333333333333';
let web: ChildProcess | undefined;
let assertions = 0;
const check = (condition: unknown, message: string) => {
  assert.ok(condition, message);
  assertions++;
};
try {
  await mkdir(resolve('.data'), { recursive: true });
  console.log(JSON.stringify({ event: 'test.initialise_postgres' }));
  await postgres.initialise();
  console.log(JSON.stringify({ event: 'test.start_postgres' }));
  await postgres.start();
  console.log(JSON.stringify({ event: 'test.create_databases' }));
  await postgres.createDatabase('uglydex_test');
  await postgres.createDatabase('uglydex_external_test');
  console.log(JSON.stringify({ event: 'test.deploy_migrations' }));
  const migration = spawnSync(
    process.execPath,
    ['node_modules/prisma/build/index.js', 'migrate', 'deploy'],
    { env: process.env, encoding: 'utf8', windowsHide: true },
  );
  if (migration.status !== 0)
    console.error(
      String(
        migration.stderr || migration.error || 'MIGRATION_SUBPROCESS_FAILED',
      ).replaceAll(process.env.DATABASE_URL!, '[isolated fixture database]'),
    );
  check(migration.status === 0, 'Prisma deploy applies committed migrations');
  console.log(JSON.stringify({ event: 'test.migrations_ready' }));
  const base = `http://127.0.0.1:${webPort}`;
  web = spawn(
    process.execPath,
    [
      'node_modules/next/dist/bin/next',
      'start',
      '-H',
      '127.0.0.1',
      '-p',
      String(webPort),
    ],
    {
      env: { ...process.env, NODE_ENV: 'production' },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    },
  );
  web.stderr?.on('data', (chunk) => process.stderr.write(chunk));
  web.stdout?.on('data', (chunk) => process.stdout.write(chunk));
  web.on('error', () => console.error('Test web process failed to spawn'));
  let ready = false;
  for (let i = 0; i < 120; i++) {
    try {
      if (
        (
          await fetch(`${base}/api/health`, {
            signal: AbortSignal.timeout(1500),
          })
        ).ok
      ) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  check(ready, 'production server healthy');

  const { interactiveCardTests } =
    await import('../tests/db/interactive-cards');
  await interactiveCardTests(base, check);
  console.log(
    JSON.stringify({ event: 'test.interactive_cards_passed', assertions }),
  );
} catch (error) {
  console.error(
    error instanceof Error ? error.message : 'Database test failed',
  );
  throw error;
} finally {
  console.log(JSON.stringify({ event: 'test.cleanup_web' }));
  if (web && web.exitCode === null && web.signalCode === null) {
    const exited = new Promise((r) => web!.once('exit', r));
    web.kill();
    await exited;
  }
  const { db } = await import('../src/server/db');
  console.log(JSON.stringify({ event: 'test.cleanup_db' }));
  await db()
    .$disconnect()
    .catch(() => undefined);
  const { closeExternalPools } = await import('../src/integrations/read-only');
  await closeExternalPools();
  console.log(JSON.stringify({ event: 'test.cleanup_postgres' }));
  // Only this invocation's generated UUID directory under the verified fixture
  // root is eligible for deletion. Copied .data fixtures are never touched.
  await postgres.stop();
  if (relative(root, directory).startsWith('..') || directory === root)
    throw new Error('UNSAFE_TEST_DIRECTORY');
  await rm(directory, {
    recursive: true,
    force: true,
    maxRetries: 8,
    retryDelay: 250,
  });
  console.log(JSON.stringify({ event: 'test.cleanup_complete' }));
}
