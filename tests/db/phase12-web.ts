import { randomBytes } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { db } from '../../src/server/db';
import { authHash } from '../../src/server/auth';

export async function phase12WebTests(
  base: string,
  check: (v: unknown, m: string) => void,
  browserTests: boolean,
  visualPreviews = false,
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

      if (visualPreviews) {
        const visualDir = resolve('.data/phase13-visual');
        await mkdir(visualDir, { recursive: true });
        const visualCollector = await db().collector.findUniqueOrThrow({
          where: { slug: 'sharing-test' },
          select: { id: true },
        });
        const visualToken = randomBytes(32).toString('hex');
        await db().authSession.create({
          data: {
            collectorId: visualCollector.id,
            tokenHash: authHash(visualToken),
            expiresAt: new Date(Date.now() + 3600000),
          },
        });
        const capture = async (
          path: string,
          file: string,
          width: number,
          height: number,
          session: string,
        ) => {
          await page.setViewportSize({ width, height });
          await page.context().clearCookies();
          await page
            .context()
            .addCookies([
              { name: 'uglydex_session', value: session, url: base },
            ]);
          const response = await page.goto(base + path, {
            waitUntil: 'domcontentloaded',
          });
          check(response?.status() === 200, `visual preview route ${path}`);
          await page.evaluate(() => document.fonts.ready.then(() => true));
          await page.locator('img').evaluateAll((images) => {
            for (const image of images)
              (image as HTMLImageElement).loading = 'eager';
          });
          await page
            .waitForFunction(
              () =>
                Array.from(document.images).every((image) => image.complete),
              undefined,
              { timeout: 12000 },
            )
            .catch(() => undefined);
          await page.waitForTimeout(250);
          check(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
            `visual preview ${path} fits ${width}px viewport`,
          );
          await page.screenshot({
            path: resolve(visualDir, file),
            fullPage: true,
            animations: 'disabled',
            timeout: 90000,
          });
        };
        await capture('/', 'landing-1440.png', 1440, 1000, visualToken);
        await capture('/me', 'my-uglydex-1440.png', 1440, 1000, visualToken);
        await capture(
          '/collection',
          'collection-1440.png',
          1440,
          1000,
          visualToken,
        );
        await capture(
          '/squig/3157',
          'squig-3157-1440.png',
          1440,
          1000,
          visualToken,
        );
        await capture(
          '/me/achievements',
          'achievements-1440.png',
          1440,
          1000,
          visualToken,
        );
        await capture('/charm', 'charm-1440.png', 1440, 1000, token);

        await capture(
          '/collection',
          'collection-1024.png',
          1024,
          900,
          visualToken,
        );
        await capture(
          '/collection',
          'collection-768.png',
          768,
          900,
          visualToken,
        );

        await page.setViewportSize({ width: 390, height: 844 });
        await page.context().clearCookies();
        await page
          .context()
          .addCookies([
            { name: 'uglydex_session', value: visualToken, url: base },
          ]);
        await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
        const mobileMenu = page.locator('.mobile-menu');
        await mobileMenu.locator('summary').focus();
        await page.keyboard.press('Enter');
        check(
          (await mobileMenu.getAttribute('open')) !== null,
          'mobile navigation opens from keyboard',
        );
        check(
          await mobileMenu
            .getByRole('link', { name: 'Explore Squigs' })
            .isVisible(),
          'mobile navigation exposes primary routes',
        );
        await page.keyboard.press('Enter');
        await capture('/', 'landing-390.png', 390, 844, visualToken);
        await capture('/me', 'my-uglydex-390.png', 390, 844, visualToken);
        await capture(
          '/collection',
          'collection-390.png',
          390,
          844,
          visualToken,
        );
        await capture(
          '/squig/3157',
          'squig-3157-390.png',
          390,
          844,
          visualToken,
        );
      }
    } finally {
      await browser.close();
    }
  }
}
