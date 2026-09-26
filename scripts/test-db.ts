// No dotenv, no TEST_DATABASE_URL and no caller-selected database. Every run owns a
// new loopback PostgreSQL cluster with random credentials in .data/test-<UUID>.
import EmbeddedPostgres from 'embedded-postgres';
import { randomBytes, randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { resolve, relative } from 'node:path';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import assert from 'node:assert/strict';
import { privateKeyToAccount } from 'viem/accounts';
import { integrationEnv } from '../src/integrations/registry';
async function unusedPort() {
  const server = createServer();
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const port = (server.address() as { port: number }).port;
  await new Promise<void>((r) => server.close(() => r()));
  return port;
}
const root = resolve('.data'),
  directory = resolve(root, `test-${randomUUID()}`);
if (relative(root, directory).startsWith('..') || directory === root)
  throw new Error('UNSAFE_TEST_DIRECTORY');
const port = await unusedPort(),
  webPort = await unusedPort(),
  password = randomBytes(24).toString('hex');
const postgres = new EmbeddedPostgres({
  databaseDir: directory,
  user: 'uglydex_test',
  password,
  port,
  persistent: false,
  // PG18 async I/O workers can outlive taskkill on Windows and retain pipes.
  // Synchronous I/O keeps this disposable fixture's shutdown deterministic.
  postgresFlags: ['-h', '127.0.0.1', '-c', 'io_method=sync'],
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
  'ECOSYSTEM_GUILD_ID',
  'SQUIG_IMAGE_BASE_URL',
])
  process.env[key] = '';
process.env.SQUIGS_CONTRACT_ADDRESS =
  '0x8c9a02c0585200c4c65608df6b8def543d33792a';
process.env.DATABASE_URL = `postgresql://uglydex_test:${password}@127.0.0.1:${port}/uglydex_test`;
Object.assign(process.env, { NODE_ENV: 'test' });
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
  await postgres.initialise();
  await postgres.start();
  await postgres.createDatabase('uglydex_test');
  await postgres.createDatabase('uglydex_external_test');
  const migration = spawnSync(
    process.execPath,
    ['node_modules/prisma/build/index.js', 'migrate', 'deploy'],
    { env: process.env, encoding: 'utf8', windowsHide: true },
  );
  check(migration.status === 0, 'Prisma deploy applies committed migrations');
  const { db } = await import('../src/server/db');
  const { productionVerify } = await import('../src/server/production-verify');
  const emptyVerification = await productionVerify();
  check(
    emptyVerification.some(
      (c) => c.name === 'catalog.integrity' && c.status === 'FAIL',
    ),
    'production verification detects an empty unbackfilled catalog',
  );
  check(
    emptyVerification.some(
      (c) => c.name === 'privacy.private_cards' && c.status === 'PASS',
    ),
    'production privacy verification runs against a fresh database',
  );
  check(
    (await db().squig.count()) === 0 &&
      (await db().productionStage.count()) === 0,
    'production verify is read-only',
  );
  const { importEvent } = await import('../src/sync/import-event');
  const { activitySchema } = await import('../src/domain/events');
  const event = activitySchema.parse({
    sourceSystem: 'uglybot',
    sourceType: 'duels',
    sourceId: 'fixture-duel',
    discordId: '123456789012345678',
    eventType: 'DUEL_PARTICIPATED',
    eventAt: '2026-01-01',
    squigTokenId: 3157,
    metadata: { status: 'pending' },
  });
  check((await importEvent(event)) === 'inserted', 'first import inserts');
  check((await importEvent(event)) === 'skipped', 'replay skips');
  check(
    (await importEvent({ ...event, metadata: { status: 'completed' } })) ===
      'updated',
    'mutable payload updates',
  );
  check((await db().collectorActivity.count()) === 1, 'one activity');
  check((await db().squigPassportEvent.count()) === 1, 'one passport');
  await Promise.all([
    importEvent({ ...event, metadata: { status: 'completed' } }),
    importEvent({ ...event, metadata: { status: 'completed' } }),
  ]);
  check(
    (await db().collectorActivity.count()) === 1,
    'concurrent replay unique',
  );
  await importEvent({
    ...event,
    squigTokenId: 12,
    metadata: { status: 'corrected' },
  });
  const passport = await db().squigPassportEvent.findFirstOrThrow({
    include: { squig: true },
  });
  check(passport.squig.tokenId === 12, 'corrected token relinks passport');
  check(
    (await db().squigPassportEvent.count()) === 1,
    'old derived passport removed',
  );
  const external = postgres.getPgClient('uglydex_external_test', '127.0.0.1');
  await external.connect();
  // Synthetic schema fixture only. Never points at an ecosystem database.
  await external.query(
    'CREATE TABLE squig_duels (id TEXT PRIMARY KEY, challenger_id TEXT, opponent_id TEXT, status TEXT, created_at TIMESTAMPTZ)',
  );
  await external.query(
    "INSERT INTO squig_duels VALUES ('fixture','123456789012345678',NULL,'pending',now())",
  );
  await external.query('CREATE ROLE uglydex_readonly LOGIN');
  await external.query(`ALTER ROLE uglydex_readonly PASSWORD '${password}'`);
  await external.query('GRANT USAGE ON SCHEMA public TO uglydex_readonly');
  await external.query(
    'GRANT SELECT ON ALL TABLES IN SCHEMA public TO uglydex_readonly',
  );
  process.env.UGLYBOT_DATABASE_URL = `postgresql://uglydex_readonly:${password}@127.0.0.1:${port}/uglydex_external_test`;
  const { readExternal, closeExternalPools } =
    await import('../src/integrations/read-only');
  const { readPage } = await import('../src/integrations/table');
  const { tables } = await import('../src/integrations/registry');
  const page = await readPage(tables.duels);
  check(
    page.ok && page.data.length === 1,
    'read-only fixture readable with optional-column drift',
  );
  if (page.ok)
    check(
      page.data[0].completed_at === null,
      'missing optional column becomes null',
    );
  const readOnly = await readExternal<{ transaction_read_only: string }>(
    'uglybot',
    "SELECT current_setting('transaction_read_only') AS transaction_read_only",
  );
  check(
    readOnly.ok && readOnly.data[0].transaction_read_only === 'on',
    'transaction enforces read only',
  );
  check(
    !(await readExternal('uglybot', 'SELECT * FROM public.missing_table')).ok,
    'missing table degrades',
  );
  const { runFeed } = await import('../src/sync/run');
  check((await runFeed('duels')).inserted === 1, 'adapter-to-import pipeline');
  check((await runFeed('duels')).skipped === 1, 'pipeline replay');
  if (process.argv.includes('--catalog')) {
    const { syncSquigs } = await import('../src/sync/squigs');
    const first = await syncSquigs();
    check(
      first.failed === 0 && first.scanned === 4444,
      'complete canonical catalog imports',
    );
    const second = await syncSquigs();
    check(
      second.failed === 0 && second.skipped === 4444,
      'catalog replay is idempotent',
    );
  }
  console.log(JSON.stringify({ event: 'test.close_fixture' }));
  const { phase1DatabaseTests } = await import('../tests/db/phase1');
  await phase1DatabaseTests(check);
  const { phase2DatabaseTests } = await import('../tests/db/phase2');
  await phase2DatabaseTests(check);
  const { phase3DatabaseTests } = await import('../tests/db/phase3');
  await phase3DatabaseTests(check, external);
  const { phase4DatabaseTests } = await import('../tests/db/phase4');
  await phase4DatabaseTests(check);
  const { phase5DatabaseTests } = await import('../tests/db/phase5');
  await phase5DatabaseTests(check);
  const { phase6DatabaseTests } = await import('../tests/db/phase6');
  await phase6DatabaseTests(check);
  const { phase7DatabaseTests } = await import('../tests/db/phase7');
  await phase7DatabaseTests(check);
  await external.end();
  console.log(JSON.stringify({ event: 'test.close_readers' }));
  await closeExternalPools();
  console.log(JSON.stringify({ event: 'test.start_web' }));
  if (process.argv.includes('--web')) {
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
    for (const path of [
      '/admin/provenance',
      '/admin/reconciliation',
      '/admin/activity',
      '/admin/progression',
    ])
      check(
        (await fetch(`${base}${path}`)).status === 404,
        `${path} denies public requests`,
      );
    const historyBody = await (
      await fetch(`${base}/squig/3157?order=oldest&event=mint`)
    ).text();
    check(
      historyBody.includes('Born ugly') &&
        historyBody.includes('etherscan.io/tx/'),
      'HTTP passport contains real mint and transaction link',
    );
    check(
      !historyBody.includes('fixture-admin') &&
        !historyBody.includes('fixture-history:'),
      'HTTP passport excludes review evidence',
    );
    check((await fetch(`${base}/`)).status === 200, 'landing renders');
    const achievementResponse = await fetch(
        `${base}/collector/progression-test/achievements`,
      ),
      achievementHTML = await achievementResponse.text();
    check(
      achievementResponse.ok && achievementHTML.includes('Step into the Ring'),
      'public achievement page renders earned history',
    );
    check(
      !achievementHTML.includes('744444444444444444') &&
        !achievementHTML.includes('p4-0') &&
        !achievementHTML.includes('test-confirmed-period'),
      'public achievement HTML excludes operational evidence',
    );
    check(
      (await fetch(`${base}/collector/progression-recipient/achievements`))
        .status === 404,
      'private collector achievements hidden',
    );
    check(
      (await fetch(`${base}/squig/4401/achievements`)).ok,
      'Squig achievements page renders',
    );
    check(
      (await fetch(`${base}/squig/4445/achievements`)).status === 404,
      'invalid Squig achievement token rejected',
    );
    check(
      (await fetch(`${base}/squig/12`)).status === 200,
      'indexed passport renders',
    );
    check(
      (await fetch(`${base}/squig/4445`)).status === 404,
      'invalid Squig is 404',
    );
    check(
      (await fetch(`${base}/admin/integrations`)).status === 404,
      'production diagnostics page hidden',
    );
    check(
      (await fetch(`${base}/api/admin/integrations`)).status === 404,
      'diagnostics API protected',
    );
    const diagnostics = await fetch(`${base}/api/admin/integrations`, {
      headers: {
        Authorization: `Bearer ${process.env.ADMIN_DIAGNOSTICS_TOKEN}`,
      },
    });
    const diagnosticBody = await diagnostics.text();
    check(
      diagnostics.ok && !diagnosticBody.includes(password),
      'admin diagnostic excludes credentials',
    );
    for (const route of ['/me/activity', '/me/creations'])
      check(
        (await fetch(base + route, { redirect: 'manual' })).status === 307,
        route + ' requires session',
      );
    const activityResponse = await fetch(
      base + '/collector/activity-collector/activity?category=MARKETPLACE',
    );
    const activityHTML = await activityResponse.text();
    check(
      activityResponse.ok && activityHTML.includes('Malformed purchase'),
      'public activity renders imported records',
    );
    check(
      !activityHTML.includes('888888888888888888') &&
        !activityHTML.includes('phase3-attribution'),
      'public activity excludes internal identities and evidence',
    );
    check(
      (await fetch(base + '/collector/activity-collector/creations')).ok,
      'public approved creator gallery',
    );
    const activityCollector = await db().collector.findUniqueOrThrow({
      where: { slug: 'activity-collector' },
    });
    await db().collector.update({
      where: { id: activityCollector.id },
      data: { isPublic: false },
    });
    check(
      (await fetch(base + '/collector/activity-collector/activity')).status ===
        404,
      'private activity route hidden',
    );
    check(
      (await fetch(base + '/collector/activity-collector/creations')).status ===
        404,
      'private creator route hidden',
    );
    await db().collector.update({
      where: { id: activityCollector.id },
      data: { isPublic: true },
    });
    const account = privateKeyToAccount(`0x${randomBytes(32).toString('hex')}`);
    const origin = process.env.PUBLIC_BASE_URL!;
    const post = (
      path: string,
      body: unknown,
      cookie = '',
      requestOrigin = origin,
    ) =>
      fetch(`${base}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: requestOrigin,
          Cookie: cookie,
        },
        body: JSON.stringify(body),
      });
    check(
      (
        await post(
          '/api/auth/wallet/nonce',
          { address: account.address },
          '',
          'https://evil.example',
        )
      ).status === 400,
      'auth rejects foreign origin',
    );
    const nonce = await post('/api/auth/wallet/nonce', {
      address: account.address,
    });
    check(nonce.ok, 'nonce generated');
    const challenge = (await nonce.json()) as { message: string };
    const cookie = nonce.headers.get('set-cookie')!.split(';')[0];
    const signature = await account.signMessage({ message: challenge.message });
    const verified = await post(
      '/api/auth/wallet/verify',
      { signature },
      cookie,
    );
    check(verified.ok, 'wallet proof establishes collector session');
    const authCookies = verified.headers.getSetCookie();
    const sessionCookie = authCookies
      .find((v) => v.startsWith('uglydex_session='))!
      .split(';')[0];
    const profile = (await verified.json()) as { slug: string };
    const privateBody = await (
      await fetch(`${base}/collector/${profile.slug}`)
    ).text();
    check(
      !privateBody.includes(account.address.toLowerCase()),
      'private profile hides linked wallet',
    );
    const ownBody = await (
      await fetch(`${base}/me`, {
        headers: { Cookie: sessionCookie },
      })
    ).text();
    check(
      ownBody.includes(account.address.toLowerCase()),
      'owner can view private dashboard',
    );
    check(
      (await post('/api/auth/wallet/verify', { signature }, cookie)).status ===
        400,
      'signature cannot replay',
    );
    const other = privateKeyToAccount(`0x${randomBytes(32).toString('hex')}`);
    const otherNonce = await post(
      '/api/auth/wallet/nonce',
      { address: other.address },
      sessionCookie,
    );
    const otherChallenge = (await otherNonce.json()) as { message: string };
    const otherCookie = otherNonce.headers.get('set-cookie')!.split(';')[0];
    const linked = await post(
      '/api/auth/wallet/verify',
      {
        signature: await other.signMessage({ message: otherChallenge.message }),
      },
      `${sessionCookie}; ${otherCookie}`,
    );
    check(linked.ok, 'second wallet can link');
    check(
      (
        await db().collectorWallet.findUniqueOrThrow({
          where: {
            chainId_walletAddress: {
              chainId: 1,
              walletAddress: other.address.toLowerCase(),
            },
          },
        })
      ).collectorId ===
        (
          await db().collectorWallet.findUniqueOrThrow({
            where: {
              chainId_walletAddress: {
                chainId: 1,
                walletAddress: account.address.toLowerCase(),
              },
            },
          })
        ).collectorId,
      'wallets share internal UUID',
    );
    check(
      (await fetch(`${base}/api/auth/discord/callback?state=wrong&code=fake`))
        .status === 400,
      'OAuth rejects missing cookie/state',
    );
    const activeCookie = linked.headers
      .getSetCookie()
      .find((v) => v.startsWith('uglydex_session='))!
      .split(';')[0];
    for (const route of [
      '/me',
      '/collection',
      '/collection/discovered',
      '/settings/profile',
      '/settings/wallets',
      '/me/achievements',
    ]) {
      const denied = await fetch(`${base}${route}`, { redirect: 'manual' });
      check(
        denied.status === 307 && denied.headers.get('location') === '/connect',
        `${route} requires authentication`,
      );
      check(
        (await fetch(`${base}${route}`, { headers: { Cookie: activeCookie } }))
          .ok,
        `${route} renders authenticated`,
      );
    }
    check(
      (await post('/api/settings/profile', {}, '', origin)).status === 401,
      'profile API requires session',
    );
    check(
      (
        await post(
          '/api/settings/profile',
          {},
          activeCookie,
          'https://evil.example',
        )
      ).status === 400,
      'profile writes enforce origin',
    );
    const signedCollector = await db().collector.findUniqueOrThrow({
      where: { slug: profile.slug },
    });
    await db().externalIdentity.create({
      data: {
        collectorId: signedCollector.id,
        provider: 'DISCORD',
        externalId: '222222222222222222',
        username: 'private-discord-marker',
        authenticatedAt: new Date(),
        metadata: { privateNote: 'NEVER_EXPOSE_THIS' },
      },
    });
    const { observe } = await import('../src/sync/blockchain');
    for (const tokenId of [1, 69, 3157])
      await db().$transaction((tx) =>
        observe(tx, {
          tokenId,
          wallet: account.address.toLowerCase(),
          block: 20000n,
          blockHash: '0x' + 'f'.repeat(64),
          time: new Date(Date.now() + 1000),
          key: `http-fixture:${tokenId}`,
          source: 'transfer',
          from: '0x' + '0'.repeat(40),
          logIndex: 0,
        }),
      );
    const settings = {
      slug: 'http-collector',
      displayName: 'The Strange Collector',
      bio: 'Test collection fixture.',
      avatar: '',
      isPublic: true,
      showWallets: false,
      showDiscord: false,
      featuredTokenIds: [1, 69],
    };
    check(
      (await post('/api/settings/profile', settings, activeCookie)).ok,
      'profile editing HTTP accepts valid owned showcase',
    );
    const published = await (
      await fetch(`${base}/collector/http-collector`)
    ).text();
    check(
      published.includes('The Strange Collector') &&
        !published.includes(account.address.toLowerCase()) &&
        !published.includes(other.address.toLowerCase()) &&
        !published.includes('private-discord-marker') &&
        !published.includes('NEVER_EXPOSE_THIS'),
      'rendered HTML and RSC preserve public identity privacy',
    );
    const passportBody = await (await fetch(`${base}/squig/1`)).text();
    check(
      !passportBody.includes('http-collector') &&
        !passportBody.includes(account.address.toLowerCase()),
      'Squig owner association is hidden when wallet visibility is disabled',
    );
    check(
      (
        await post(
          '/api/settings/profile',
          { ...settings, showWallets: true, showDiscord: true },
          activeCookie,
        )
      ).ok,
      'visibility can be enabled explicitly',
    );
    const visible = await (
      await fetch(`${base}/collector/http-collector`)
    ).text();
    check(
      visible.includes(account.address.toLowerCase()) &&
        visible.includes('private-discord-marker') &&
        !visible.includes('222222222222222222') &&
        !visible.includes('NEVER_EXPOSE_THIS'),
      'public opt-in exposes only approved identity fields',
    );
    await post(
      '/api/settings/profile',
      { ...settings, isPublic: false },
      activeCookie,
    );
    check(
      (await fetch(`${base}/collector/http-collector`)).status === 404,
      'private profile returns 404',
    );
    await post('/api/settings/profile', settings, activeCookie);
    check(
      (await post('/api/collection/refresh', {}, activeCookie)).status === 503,
      'refresh reports unavailable RPC without pretending success',
    );
    check(
      (await fetch(`${base}/api/collection/refresh`)).status === 401,
      'refresh status requires session',
    );
    check(
      (
        await fetch(`${base}/admin/provenance`, {
          headers: { Cookie: activeCookie },
        })
      ).status === 404,
      'ordinary collector cannot access provenance admin',
    );
    check(
      (await post('/api/admin/provenance', { tokenId: 3157 }, activeCookie))
        .status === 404,
      'ordinary collector cannot queue admin rebuild',
    );
    await db().externalIdentity.create({
      data: {
        collectorId: signedCollector.id,
        provider: 'DISCORD',
        externalId: '333333333333333333',
        authenticatedAt: new Date(),
      },
    });
    for (const path of [
      '/admin/provenance?token=3157',
      '/admin/reconciliation',
      '/admin/activity',
      '/admin/integrations',
      '/admin/progression',
    ])
      check(
        (await fetch(`${base}${path}`, { headers: { Cookie: activeCookie } }))
          .ok,
        `${path} allows authenticated Discord admin`,
      );
    check(
      (
        await post(
          '/api/admin/provenance',
          { tokenId: 3157 },
          activeCookie,
          'https://evil.example',
        )
      ).status === 400,
      'admin mutation rejects foreign origin',
    );
    check(
      (await post('/api/admin/provenance', { tokenId: 3157 }, activeCookie)).ok,
      'admin can queue safe rebuild',
    );
    const { derivePending } = await import('../src/sync/provenance');
    await derivePending();
    const { gauntletEvents } =
      await import('../src/integrations/gauntlet/survival');
    const { importRecord: importProgressionRecord } =
      await import('../src/sync/import-event');
    const { rebuildSubject } = await import('../src/server/progression-engine');
    await importProgressionRecord(
      'survival',
      'phase4-browser',
      gauntletEvents('survival', {
        id: 'phase4-browser',
        game_id: '999',
        user_id: '222222222222222222',
        started_at: new Date('2026-08-01'),
        placement: 1,
        eliminations: 1,
        deaths: 0,
        images_used: 1,
      }),
    );
    await rebuildSubject('COLLECTOR', signedCollector.id);
    const review = await db().identityReconciliation.findUniqueOrThrow({
      where: { dedupeKey: 'fixture-review' },
    });
    const reviewEvidence = review.evidence as { attributionId: string };
    check(
      (
        await post(
          '/api/admin/reconciliation',
          {
            caseId: review.id,
            attributionId: reviewEvidence.attributionId,
            action: 'CONFIRM',
            reason: 'HTTP test reaffirms existing fixture evidence.',
          },
          activeCookie,
        )
      ).ok,
      'authorized review API records auditable decision',
    );
    await derivePending();
    const { rebuildCollection } = await import('../src/server/dex-engine');
    await rebuildCollection(signedCollector.id);
    for (const path of [
      '/collection/dex',
      '/collection/traits',
      '/collection/sets',
    ]) {
      check(
        (await fetch(base + path, { redirect: 'manual' })).status === 307,
        'private Dex route requires authentication: ' + path,
      );
      check(
        (await fetch(base + path, { headers: { Cookie: activeCookie } })).ok,
        'authenticated Dex route: ' + path,
      );
    }
    check(
      (await fetch(base + '/collector/dex-private/sets')).status === 404,
      'private collector set page hidden',
    );
    check(
      (await fetch(base + '/collector/dex-test/sets')).ok,
      'public collector set page',
    );
    check(
      (await fetch(base + '/sets/no-such-set')).status === 404,
      'invalid set route',
    );
    check(
      (await fetch(base + '/traits/Bad/Unknown')).status === 404,
      'invalid trait route',
    );
    check(
      (await fetch(base + '/traits/Body/Diving%20Suit')).ok,
      'normalized trait route',
    );
    const secretBody = await (await fetch(base + '/sets/static-signal')).text();
    check(
      !secretBody.includes('Gold Terminator') && !secretBody.includes('Atomic'),
      'hidden set conditions absent from HTML and RSC',
    );
    check(
      (await fetch(base + '/admin/collections')).status === 404,
      'collection admin requires authorization',
    );
    check(
      (
        await fetch(base + '/admin/collections', {
          headers: { Cookie: activeCookie },
        })
      ).ok,
      'authorized collection admin available',
    );
    if (process.argv.includes('--browser')) {
      await rebuildSubject('COLLECTOR', signedCollector.id);
      const { progressionView } = await import('../src/server/progression');
      check(
        (await progressionView('COLLECTOR', signedCollector.id))?.status ===
          'ready',
        'reviewed evidence reevaluated before browser preference editing',
      );
      const { chromium } = await import('@playwright/test');
      const browser = await chromium.launch({ headless: true });
      try {
        const page = await browser.newPage({
          viewport: { width: 1440, height: 1000 },
        });
        await page.goto(
          base + '/collector/activity-collector/activity?category=MARKETPLACE',
        );
        await page
          .getByRole('heading', { name: 'Ecosystem field notes.' })
          .waitFor();
        check(
          await page.getByRole('link', { name: 'More history →' }).isVisible(),
          'browser activity has pagination',
        );
        await page.getByRole('link', { name: 'More history →' }).click();
        await page.waitForURL('**after=*');
        check(
          (await page.locator('.history-timeline li').count()) > 0,
          'browser next activity page',
        );
        await page
          .getByRole('navigation', { name: 'Activity categories' })
          .getByRole('link', { name: 'duels', exact: true })
          .click();
        await page.waitForURL('**category=DUELS**');
        check(
          await page
            .getByRole('heading', { name: 'Duel complete', exact: true })
            .first()
            .isVisible(),
          'browser category filtering',
        );
        await page.setViewportSize({ width: 390, height: 844 });
        check(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          'mobile activity has no horizontal overflow',
        );
        await page.screenshot({
          path: '.data/phase3-activity-mobile.png',
          fullPage: true,
        });
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page.screenshot({
          path: '.data/phase3-activity-desktop.png',
          fullPage: true,
        });
        const errors: string[] = [];
        // Loopback test server uses HTTP while production origin policy is HTTPS.
        // Simulate that configured origin only for this owned test server's APIs;
        // separate HTTP tests above prove foreign-origin rejection.
        await page.route(`${base}/api/**`, async (route) => {
          const response = await route.fetch({
            headers: { ...(await route.request().allHeaders()), origin },
          });
          await route.fulfill({ response });
        });
        page.on('pageerror', (e) => errors.push(e.message));
        await page.goto(base);
        check(
          await page
            .getByRole('heading', {
              name: /Every Squig.*has a story/,
            })
            .isVisible(),
          'browser hero visible',
        );
        await page.getByRole('button', { name: 'Connect Wallet' }).click();
        check(
          (await page.getByRole('status').textContent()) ===
            'Open UglyDex in a browser with an Ethereum wallet installed.',
          'wallet missing state shown',
        );
        if (process.argv.includes('--catalog')) {
          await page
            .getByRole('img', { name: 'Squig #1', exact: true })
            .scrollIntoViewIfNeeded();
          await page.waitForFunction(
            () => {
              const img = document.querySelector<HTMLImageElement>(
                'img[alt="Squig #1"]',
              );
              return !!img?.complete && img.naturalWidth > 0;
            },
            {},
            { timeout: 25000 },
          );
          check(
            true,
            'canonical IPFS image renders through optimized delivery',
          );
          await page.evaluate(() => window.scrollTo(0, 0));
        }
        await page.screenshot({
          path: '.data/uglydex-desktop.png',
          fullPage: true,
        });
        await page.setViewportSize({ width: 390, height: 844 });
        await page.screenshot({
          path: '.data/uglydex-mobile.png',
          fullPage: true,
        });
        check(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
          'mobile has no horizontal overflow',
        );
        await page.goto(`${base}/squigs?q=69`);
        check(
          await page
            .getByRole('heading', { name: 'Squig #69', exact: true })
            .isVisible(),
          'explorer renders server-filtered token',
        );
        await page
          .getByRole('button', { name: 'Compact', exact: false })
          .click();
        await page.reload();
        check(
          (await page
            .getByRole('button', { name: 'Compact', exact: false })
            .getAttribute('aria-pressed')) === 'true',
          'compact preference survives reload',
        );
        await page.goto(`${base}/squig/69`);
        check(
          await page
            .getByRole('heading', { name: 'Squig #69', exact: true })
            .isVisible(),
          'definitive Squig profile renders',
        );
        check(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
          'mobile Squig profile fits viewport',
        );
        await page.screenshot({
          path: '.data/uglydex-squig-mobile.png',
          fullPage: true,
        });
        await page.goto(`${base}/squig/3157?order=oldest`);
        await page.locator('#passport').scrollIntoViewIfNeeded();
        check(
          await page
            .getByRole('heading', { name: 'Born ugly', exact: true })
            .isVisible(),
          'browser renders chain-backed mint',
        );
        await page
          .getByRole('navigation', { name: 'Passport pages' })
          .getByRole('link', { name: 'Next', exact: false })
          .click();
        await page.waitForURL((url) => url.searchParams.get('page') === '2');
        check(
          new URL(page.url()).searchParams.get('page') === '2',
          'passport pagination preserves URL state',
        );
        await page
          .getByRole('combobox', { name: 'Passport event type', exact: true })
          .selectOption('mint');
        await page
          .getByRole('button', { name: 'View history', exact: true })
          .click();
        await page.waitForURL(
          (url) => url.searchParams.get('event') === 'mint',
        );
        await page.waitForFunction(
          () =>
            document.querySelectorAll('#passport .history-timeline li')
              .length === 1,
        );
        await page
          .getByRole('heading', { name: 'Born ugly', exact: true })
          .waitFor();
        check(
          (await page.locator('#passport .history-timeline li').count()) === 1,
          'browser mint filter selects one event',
        );
        check(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          'mobile passport fits viewport',
        );
        await page.screenshot({
          path: '.data/phase2-passport-mobile.png',
          fullPage: true,
        });
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page.goto(`${base}/squig/3157?order=oldest`);
        await page.locator('#passport').scrollIntoViewIfNeeded();
        await page.screenshot({
          path: '.data/phase2-passport-desktop.png',
          fullPage: true,
        });
        await page.context().addCookies([
          {
            name: 'uglydex_session',
            value: activeCookie.split('=')[1],
            url: base,
            httpOnly: true,
            sameSite: 'Lax',
            secure: false,
          },
        ]);
        await page.goto(`${base}/collection`);
        check(
          await page
            .getByRole('heading', { name: 'The usual suspects.' })
            .isVisible(),
          'authenticated collection gallery works in browser',
        );
        check(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
          'authenticated mobile navigation and filters fit viewport',
        );
        await page.getByRole('button', { name: 'Grid', exact: false }).click();
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page.screenshot({
          path: '.data/uglydex-collection-desktop.png',
          fullPage: true,
        });
        await page.goto(`${base}/me/achievements`);
        await page
          .getByLabel('Profile title', { exact: true })
          .selectOption('collector-survivalWins-1');
        await page
          .getByRole('checkbox', { name: 'Survivor', exact: true })
          .check();
        await page
          .getByRole('button', { name: 'Save title and badges', exact: true })
          .click();
        await page
          .getByRole('status')
          .filter({ hasText: 'Your title and badges are saved.' })
          .waitFor();
        check(
          true,
          'authenticated badge/title preferences save through server action',
        );
        await page.reload();
        check(
          (await page
            .getByLabel('Profile title', { exact: true })
            .inputValue()) === 'collector-survivalWins-1',
          'selected title survives reload',
        );
        await page.screenshot({
          path: '.data/phase4-achievements-desktop.png',
          fullPage: false,
        });
        await page.setViewportSize({ width: 390, height: 844 });
        check(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          'mobile achievements fit viewport',
        );
        await page.screenshot({
          path: '.data/phase4-achievements-mobile.png',
          fullPage: false,
        });
        await page.goto(base + '/collection/dex');
        check(
          await page
            .getByRole('heading', { name: 'Leave no ugly unexplored.' })
            .isVisible(),
          'Dex flagship page renders',
        );
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page.screenshot({
          path: '.data/phase5-dex-desktop.png',
          fullPage: false,
        });
        await page.goto(base + '/collection/traits?category=Eyes');
        check(
          await page
            .getByRole('heading', { name: 'The Trait Dex.' })
            .isVisible(),
          'trait Dex renders',
        );
        check(
          (await page.locator('.trait-tile').count()) === 19,
          'trait category filter returns canonical Eyes values',
        );
        await page.setViewportSize({ width: 390, height: 844 });
        check(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          'mobile Trait Dex fits viewport',
        );
        await page.screenshot({
          path: '.data/phase5-traits-mobile.png',
          fullPage: false,
        });
        await page.goto(base + '/collection/sets?mode=CURRENT_HOLDING');
        check(
          (await page.locator('.set-tile').count()) === 13,
          'current set filter',
        );
        await page
          .getByRole('button', { name: 'Save featured sets', exact: true })
          .click();
        await page
          .getByRole('status')
          .filter({ hasText: 'Featured sets saved.' })
          .waitFor();
        check(true, 'showcase preferences save through authenticated action');
        await page.goto(base + '/squigs?dex=undiscovered');
        check(
          (await page
            .getByLabel('My field guide', { exact: true })
            .inputValue()) === 'undiscovered',
          'personalized explorer filter persists in URL',
        );
        await page.goto(base + '/settings/profile');
        await page
          .getByLabel('Display name', { exact: true })
          .fill('Browser Edited Collector');
        const saveResponse = page.waitForResponse(
          (r) =>
            r.url() === `${base}/api/settings/profile` &&
            r.request().method() === 'POST',
        );
        await page
          .getByRole('button', { name: 'Save profile', exact: true })
          .click();
        const saved = await saveResponse;
        const saveBody = await saved.json();
        check(
          saved.ok(),
          `browser profile save response: ${saved.status()} ${JSON.stringify(saveBody)}`,
        );
        await page
          .getByRole('status')
          .filter({ hasText: 'Profile saved.' })
          .waitFor();
        check(true, 'profile form saves through authenticated API');
        check(errors.length === 0, 'browser has no runtime errors');
      } finally {
        for (const context of browser.contexts())
          await context.request.dispose();
        await browser.close();
      }
    }
  }
  if (process.argv.includes('--web')) {
    const { phase6WebTests } = await import('../tests/db/phase6-web');
    await phase6WebTests(
      `http://127.0.0.1:${webPort}`,
      check,
      process.argv.includes('--browser'),
    );
    const { phase7WebTests } = await import('../tests/db/phase7-web');
    await phase7WebTests(
      `http://127.0.0.1:${webPort}`,
      check,
      process.argv.includes('--browser'),
    );
  }
  await db().$disconnect();
  console.log(JSON.stringify({ event: 'test.database_passed', assertions }));
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
  // Directory was verified under this workspace before enabling disposable cleanup.
  await postgres.stop();
  console.log(JSON.stringify({ event: 'test.cleanup_complete' }));
}
