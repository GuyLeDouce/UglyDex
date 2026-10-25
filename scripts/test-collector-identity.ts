// Isolated identity regression runner: no caller-selected database or upstreams.
import { randomBytes, randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import assert from 'node:assert/strict';
import { fixturePostgres } from './test-postgres';
import { integrationEnv } from '../src/integrations/registry';
async function freePort() {
  const server = createServer();
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const port = (server.address() as { port: number }).port;
  await new Promise<void>((r) => server.close(() => r()));
  return port;
}
const directory = resolve('.data', `identity-${randomUUID()}`);
const port = await freePort(),
  webPort = await freePort();
for (const key of Object.values(integrationEnv)) process.env[key] = '';
for (const key of Object.keys(process.env)) {
  if (
    /^(DRIP_|UGLYBOT_|GAUNTLET_|IMAGE_BRIDGE_|ARTWORK_S3_|DISCORD_|ETH_RPC_URL|OPENSEA_API_KEY)/.test(
      key,
    )
  )
    process.env[key] = '';
}
Object.assign(process.env, {
  NODE_ENV: 'test',
  APP_ENV: 'development',
  DATABASE_URL: `postgresql://identity_test:${randomBytes(24).toString('hex')}@127.0.0.1:${port}/identity_test`,
  AUTH_SECRET: randomBytes(32).toString('hex'),
  PUBLIC_BASE_URL: `https://localhost:${webPort}`,
});
const EmbeddedPostgres = await fixturePostgres(directory);
const postgres = new EmbeddedPostgres({
  databaseDir: resolve(directory, 'cluster'),
  user: 'identity_test',
  password: new URL(process.env.DATABASE_URL!).password,
  port,
  persistent: true,
  postgresFlags: ['-h', '127.0.0.1', '-c', 'io_method=sync'],
  onLog: () => {},
  onError: () => {},
});
let web: ChildProcess | undefined;
let assertions = 0;
const check = (value: unknown, message: string) => {
  assert.ok(value, message);
  assertions++;
};
try {
  await mkdir(directory, { recursive: true });
  await postgres.initialise();
  await postgres.start();
  await postgres.createDatabase('identity_test');
  const migration = spawnSync(
    process.execPath,
    ['node_modules/prisma/build/index.js', 'migrate', 'deploy'],
    { env: process.env, encoding: 'utf8' },
  );
  check(migration.status === 0, 'identity fixture migrations apply');
  const { collectorIdentityTests } =
    await import('../tests/db/collector-identity');
  await collectorIdentityTests(check);
  const { fieldGuidePossessionTests } =
    await import('../tests/db/field-guide-possession');
  await fieldGuidePossessionTests(check);
  const { progressionQueueRaceTests } =
    await import('../tests/db/progression-queue-race');
  await progressionQueueRaceTests(check);
  console.log(
    JSON.stringify({ event: 'identity.database_passed', assertions }),
  );
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
    },
  );
  web.stderr?.on('data', (chunk) => process.stderr.write(chunk));
  const base = `http://127.0.0.1:${webPort}`;
  let ready = false;
  for (let i = 0; i < 120; i++) {
    try {
      if (
        (
          await fetch(base + '/api/health', {
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
  check(ready, 'identity fixture production server healthy');
  const { collectorIdentityWebTests } =
    await import('../tests/db/collector-identity-web');
  await collectorIdentityWebTests(base, check);
  console.log(JSON.stringify({ event: 'identity.all_passed', assertions }));
} finally {
  if (web && web.exitCode === null && web.signalCode === null) {
    const exited = new Promise((r) => web!.once('exit', r));
    web.kill();
    await exited;
  }
  const { db } = await import('../src/server/db');
  await db().$disconnect();
  await postgres.stop();
  await rm(directory, {
    recursive: true,
    force: true,
    maxRetries: 8,
    retryDelay: 250,
  });
}
