import { randomBytes } from 'node:crypto';
import { db } from '../../src/server/db';
import { authHash } from '../../src/server/auth';

export async function phase12WebTests(
  base: string,
  check: (v: unknown, m: string) => void,
  browserTests: boolean,
) {
  const collector = await db().collector.findUniqueOrThrow({
    where: { slug: 'charm-fixture' },
  });
  const token = randomBytes(32).toString('hex');
  await db().authSession.create({
    data: {
      collectorId: collector.id,
      tokenHash: authHash(token),
      expiresAt: new Date(Date.now() + 3600000),
    },
  });
  const headers = { Cookie: 'uglydex_session=' + token };
  const balance = '123456789.125';
  const infrastructure = [
    'c'.repeat(24),
    'a'.repeat(24),
    'b'.repeat(24),
    'fixture-key-never-public',
  ];
  const privateValues = [balance, '123,456,789.125', ...infrastructure];
  await db().collector.update({
    where: { id: collector.id },
    data: { showCharmBalance: false },
  });
  const denied = await fetch(base + '/charm', { redirect: 'manual' });
  check(
    [302, 303, 307, 308, 401, 404].includes(denied.status),
    'anonymous CHARM page denied',
  );
  check(
    (
      await fetch(base + '/api/charm/refresh', {
        method: 'POST',
        headers: { Origin: process.env.PUBLIC_BASE_URL! },
      })
    ).status === 401,
    'anonymous CHARM refresh denied',
  );
  const profile = await (await fetch(base + '/collector/charm-fixture')).text();
  check(
    privateValues.every((v) => !profile.includes(v)),
    'private balance and DRIP identifiers absent from public HTML and serialized page data',
  );
  const scripts = [
    ...new Set(
      [...profile.matchAll(/src="([^"]+)"/g)]
        .map((m) => m[1])
        .filter(
          (path) => path.startsWith('/_next/static/') && path.includes('.js'),
        ),
    ),
  ];
  check(
    scripts.length > 0,
    'privacy test inspects actual compiled client assets',
  );
  for (const script of scripts) {
    const response = await fetch(new URL(script, base));
    const code = await response.text();
    check(
      response.ok &&
        !code.includes('DRIP_READ_API_KEY') &&
        infrastructure.every((v) => !code.includes(v)),
      'compiled client bundle excludes DRIP key and infrastructure identities',
    );
  }
  const metadata = await (
    await fetch(base + '/share?entity=charm-fixture')
  ).text();
  check(
    privateValues.every((v) => !metadata.includes(v)),
    'private balance and infrastructure identifiers absent from share/OG metadata',
  );
  const pngBefore = await fetch(base + '/api/share?entity=charm-fixture');
  check(
    pngBefore.ok && pngBefore.headers.get('content-type') === 'image/png',
    'private CHARM profile share PNG renders',
  );
  const before = Buffer.from(await pngBefore.arrayBuffer());
  await db().charmBalance.updateMany({
    where: { collectorId: collector.id },
    data: { balance: '987654321.875' },
  });
  const after = Buffer.from(
    await (await fetch(base + '/api/share?entity=charm-fixture')).arrayBuffer(),
  );
  check(
    before.equals(after),
    'changing private authoritative balance cannot affect share PNG pixels',
  );
  await db().charmBalance.updateMany({
    where: { collectorId: collector.id },
    data: { balance },
  });
  const authenticated = await (
    await fetch(base + '/charm', { headers })
  ).text();
  check(
    authenticated.includes('123,456,789.125'),
    'authenticated CHARM page displays cached exact balance',
  );
  check(
    infrastructure.every((v) => !authenticated.includes(v)),
    'authenticated HTML still excludes DRIP identifiers and API key',
  );
  await db().collector.update({
    where: { id: collector.id },
    data: { showCharmBalance: true },
  });
  const opted = await (await fetch(base + '/collector/charm-fixture')).text();
  check(
    opted.includes('123,456,789.125'),
    'public opt-in shows balance only on intended profile',
  );
  check(
    infrastructure.every((v) => !opted.includes(v)),
    'public opt-in never exposes DRIP identities or key',
  );
  if (browserTests) {
    const { chromium } = await import('@playwright/test');
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      let directDripCalls = 0;
      page.on('request', (request) => {
        if (new URL(request.url()).hostname === 'api.drip.re')
          directDripCalls++;
      });
      await page
        .context()
        .addCookies([{ name: 'uglydex_session', value: token, url: base }]);
      await page.goto(base + '/charm');
      await page
        .getByRole('heading', { name: '$CHARM', exact: true })
        .waitFor();
      check(
        (await page.locator('body').innerText()).includes('123,456,789.125'),
        'browser authenticates and renders cached CHARM balance',
      );
      check(directDripCalls === 0, 'browser never calls DRIP directly');
      await db().collector.update({
        where: { id: collector.id },
        data: { showCharmBalance: false },
      });
      await page.goto(base + '/collector/charm-fixture');
      check(
        !(await page.locator('body').innerText()).includes('123,456,789.125'),
        'browser public profile honors private preference',
      );
    } finally {
      await browser.close();
    }
  }
}
