// Disposable loopback database; never reads developer credentials or production data.
import { fixturePostgres } from './test-postgres';
import { randomBytes, randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
const server = createServer();
await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
const port = (server.address() as { port: number }).port;
await new Promise<void>((r) => server.close(() => r()));
const directory = resolve('.data', 'ecosystem-' + randomUUID()),
  password = randomBytes(24).toString('hex');
const Pg = await fixturePostgres(directory);
const pg = new Pg({
  databaseDir: directory,
  user: 'ecosystem_test',
  password,
  port,
  persistent: false,
  postgresFlags: ['-h', '127.0.0.1', '-k', ''],
  onLog: () => {},
  onError: () => {},
});
Object.assign(process.env, {
  DATABASE_URL: `postgresql://ecosystem_test:${password}@127.0.0.1:${port}/ecosystem_test`,
  NODE_ENV: 'test',
  APP_ENV: 'development',
  PUBLIC_BASE_URL: 'http://localhost:3000',
  AUTH_SECRET: randomBytes(32).toString('hex'),
});
let assertions = 0;
const check = (v: unknown, m: string) => {
  assert.ok(v, m);
  assertions++;
};
try {
  await pg.initialise();
  await pg.start();
  await pg.createDatabase('ecosystem_test');
  await pg.createDatabase('ecosystem_external_test');
  const migration = spawnSync(
    process.execPath,
    ['node_modules/prisma/build/index.js', 'migrate', 'deploy'],
    { env: process.env, encoding: 'utf8' },
  );
  assert.equal(migration.status, 0, migration.stderr);
  const { Client } = await import('pg');
  const externalUrl = new URL(process.env.DATABASE_URL!);
  externalUrl.pathname = '/ecosystem_external_test';
  const external = new Client({ connectionString: externalUrl.href });
  await external.connect();
  const readerPassword = randomBytes(24).toString('hex');
  await external.query(
    `CREATE ROLE uglydex_reader LOGIN PASSWORD '${readerPassword}'`,
  );
  const readerUrl = `postgresql://uglydex_reader:${readerPassword}@127.0.0.1:${port}/ecosystem_external_test`;
  const { integrationEnv } = await import('../src/integrations/registry');
  for (const key of Object.values(integrationEnv)) process.env[key] = '';
  for (const group of ['UGLYBOT', 'GAUNTLET', 'IMAGE']) {
    process.env[group + '_BRIDGE_URL'] = '';
    process.env[group + '_BRIDGE_SECRET'] = '';
  }
  process.env.GAUNTLET_DATABASE_URL = readerUrl;
  process.env.UGLYBOT_PRIZES_DATABASE_URL = readerUrl;
  try {
    await external.query(
      `CREATE TABLE gauntlet_runs (id bigint PRIMARY KEY,user_id text,score int,finished_at timestamptz)`,
    );
    await external.query(
      `CREATE TABLE marketplace_purchases (id bigint PRIMARY KEY,discord_id text,spent_amount numeric,created_at timestamptz,refunded_at timestamptz,refunded_amount numeric)`,
    );
    await external.query(
      'GRANT SELECT ON gauntlet_runs,marketplace_purchases TO uglydex_reader',
    );
    await external.query(
      `INSERT INTO gauntlet_runs SELECT n,'888888888888888888',10,now() FROM generate_series(1,401) n`,
    );
    const { runActivityFeed } = await import('../src/sync/activity');
    const { db } = await import('../src/server/db');
    check(
      (await runActivityFeed('runs', { maxPages: 4 })).scanned === 401,
      'backfill reads every completed run',
    );
    const before = await db().integrationSource.findUniqueOrThrow({
      where: { id: 'runs' },
    });
    check(!!before.backfillFinishedAt, 'backfill completion recorded');
    await db().integrationSource.update({
      where: { id: 'runs' },
      data: { reconcileCursor: ['1'] },
    });
    await external.query(
      `INSERT INTO gauntlet_runs VALUES(402,'888888888888888888',20,now())`,
    );
    check(
      (await runActivityFeed('runs', { maxPages: 1 })).scanned === 1,
      'new rows arrive independently of historical sweep',
    );
    const advanced = await db().integrationSource.findUniqueOrThrow({
      where: { id: 'runs' },
    });
    check(
      JSON.stringify(advanced.cursor) === '["402"]',
      'head cursor advances',
    );
    check(
      JSON.stringify(advanced.reconcileCursor) === '["1"]',
      'head import preserves historical sweep',
    );
    check(
      (await runActivityFeed('runs', { maxPages: 1, recent: true })).scanned ===
        200,
      'newest-first refresh is bounded',
    );
    const after = await db().integrationSource.findUniqueOrThrow({
      where: { id: 'runs' },
    });
    check(
      JSON.stringify(after.cursor) === JSON.stringify(advanced.cursor) &&
        JSON.stringify(after.reconcileCursor) ===
          JSON.stringify(advanced.reconcileCursor),
      'recent refresh preserves both cursors',
    );
    check(
      after.backfillFinishedAt?.getTime() ===
        advanced.backfillFinishedAt?.getTime(),
      'recent refresh never claims a historical backfill',
    );
    await external.query(
      `INSERT INTO marketplace_purchases VALUES(1,'888888888888888888',100,now(),NULL,NULL)`,
    );
    check(
      (await runActivityFeed('purchases', { maxPages: 1 })).inserted === 1,
      'marketplace purchase imports',
    );
    await external.query(
      'UPDATE marketplace_purchases SET refunded_at=now(),refunded_amount=100 WHERE id=1',
    );
    check(
      (await runActivityFeed('purchases', { maxPages: 1 })).scanned === 0,
      'old-row correction is behind the head',
    );
    check(
      (await runActivityFeed('purchases', { maxPages: 1, recent: true }))
        .inserted === 1,
      'recent refresh captures a later refund without updated_at',
    );
    const { readDirectPage } = await import('../src/integrations/table');
    const { tables } = await import('../src/integrations/registry');
    const first = await readDirectPage(
      tables.runs,
      undefined,
      {},
      2,
      undefined,
      'desc',
    );
    check(
      first.ok &&
        String(first.data[0].id) === '402' &&
        String(first.data[1].id) === '401',
      'descending page returns newest records first',
    );
    const second = await readDirectPage(
      tables.runs,
      ['401'],
      {},
      2,
      undefined,
      'desc',
    );
    check(
      second.ok && String(second.data[0].id) === '400',
      'descending cursor advances without duplicates',
    );
    console.log(
      JSON.stringify({ event: 'ecosystem.database_verified', assertions }),
    );
  } finally {
    await external.end();
  }
} finally {
  const { closeExternalPools } = await import('../src/integrations/read-only');
  await closeExternalPools();
  const { db } = await import('../src/server/db');
  await db().$disconnect();
  await pg.stop();
}
