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
const directory = resolve('.data', 'mastery-' + randomUUID()),
  password = randomBytes(24).toString('hex');
const Pg = await fixturePostgres(directory);
const pg = new Pg({
  databaseDir: directory,
  user: 'mastery_test',
  password,
  port,
  persistent: false,
  postgresFlags: ['-h', '127.0.0.1', '-k', ''],
  onLog: () => {},
  onError: () => {},
});
Object.assign(process.env, {
  DATABASE_URL: `postgresql://mastery_test:${password}@127.0.0.1:${port}/mastery_test`,
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
  await pg.createDatabase('mastery_test');
  const m = spawnSync(
    process.execPath,
    ['node_modules/prisma/build/index.js', 'migrate', 'deploy'],
    { env: process.env, encoding: 'utf8' },
  );
  assert.equal(m.status, 0, m.stderr);
  const { seedProgression } = await import('../src/server/progression-engine');
  await seedProgression();
  const { phase5DatabaseTests } = await import('../tests/db/phase5');
  await phase5DatabaseTests(check);
  const { db } = await import('../src/server/db');
  const { COLLECTION_RULESET: R, completion } =
    await import('../src/domain/dex');
  const { traitCatalog, collectionSets } =
    await import('../src/domain/dex-catalog');
  const { topCollectors } = await import('../src/server/community');
  const { dexView } = await import('../src/server/dex');
  const { SQUIGS_CONTRACT } = await import('../src/domain/validation');
  const historicalTotal = collectionSets.filter(
    (s) => s.mode === 'HISTORICAL_DISCOVERY' && !s.hidden,
  ).length;
  for (const [i, discovered] of [250, 250, 125].entries()) {
    const c = await db().collector.create({
      data: {
        slug: 'mastery-rank-' + i,
        isPublic: true,
        claimedAt: new Date(),
      },
    });
    const wallet = '0x' + String(i + 1).padStart(40, '0');
    await db().collectorWallet.create({
      data: {
        collectorId: c.id,
        chainId: 1,
        walletAddress: wallet,
        source: 'test',
        verifiedAt: new Date(),
      },
    });
    const s = await db().squig.upsert({
      where: {
        chainId_contractAddress_tokenId: {
          chainId: 1,
          contractAddress: SQUIGS_CONTRACT,
          tokenId: 100 + i,
        },
      },
      create: {
        chainId: 1,
        contractAddress: SQUIGS_CONTRACT,
        tokenId: 100 + i,
      },
      update: {},
    });
    await db().squigOwnership.create({
      data: {
        squigId: s.id,
        walletAddress: wallet,
        sourceKey: 'mastery-' + i,
        source: 'test',
        blockNumber: 1n,
        blockHash: 'fixture',
        isCurrent: true,
      },
    });
    const score = completion(
      discovered,
      100,
      traitCatalog.length,
      1,
      historicalTotal,
      1,
    );
    await db().collectionSnapshot.create({
      data: {
        ruleset: R,
        collectorId: c.id,
        discovered,
        traits: 100,
        historicalSets: 1,
        currentSets: 0,
        overall: score.overall,
        currentTokenIds: [100 + i],
        discoveredTokenIds: [],
        candidates: {},
      },
    });
    await db().collectionJob.deleteMany({ where: { collectorId: c.id } });
    const view = await dexView(c.id, true);
    check(
      view?.status === 'ready' && view.score.overall === score.overall,
      'profile uses exact mastery',
    );
  }
  const rows = (await topCollectors()).collectors.filter((r) =>
    r.slug.startsWith('mastery-rank-'),
  );
  check(
    rows.length === 3 &&
      rows[0].rank === rows[1].rank &&
      rows[2].rank! > rows[0].rank!,
    'leaderboard respects exact scores and ties',
  );
  const c = await db().collector.create({
      data: { slug: 'mastery-unclaimed', isPublic: true },
    }),
    wallet = '0x' + 'ab'.repeat(20);
  await db().discoveredWallet.create({
    data: { collectorId: c.id, chainId: 1, walletAddress: wallet },
  });
  const squig = await db().squig.upsert({
    where: {
      chainId_contractAddress_tokenId: {
        chainId: 1,
        contractAddress: SQUIGS_CONTRACT,
        tokenId: 103,
      },
    },
    create: { chainId: 1, contractAddress: SQUIGS_CONTRACT, tokenId: 103 },
    update: {},
  });
  await db().squigOwnership.create({
    data: {
      squigId: squig.id,
      walletAddress: wallet,
      sourceKey: 'unclaimed-mastery',
      source: 'test',
      blockNumber: 1n,
      blockHash: 'fixture',
      isCurrent: true,
    },
  });
  const view = await dexView(c.id, true),
    row = (await topCollectors()).collectors.find((r) => r.slug === c.slug);
  check(
    view?.status === 'ready' &&
      view.basis === 'wallet' &&
      row?.overall === view.score.overall,
    'unclaimed profile and leaderboard agree',
  );
  console.log(
    JSON.stringify({ event: 'mastery.database_verified', assertions }),
  );
} finally {
  const { db } = await import('../src/server/db');
  await db().$disconnect();
  await pg.stop();
}
