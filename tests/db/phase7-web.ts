import { randomBytes } from 'node:crypto';
import { db } from '../../src/server/db';
import { authHash } from '../../src/server/auth';
export async function phase7WebTests(
  base: string,
  check: (v: unknown, m: string) => void,
  browserTests: boolean,
) {
  const c = await db().collector.findUniqueOrThrow({
      where: { slug: 'phase7-collector' },
    }),
    token = randomBytes(32).toString('hex');
  await db().authSession.create({
    data: {
      collectorId: c.id,
      tokenHash: authHash(token),
      expiresAt: new Date(Date.now() + 3600000),
    },
  });
  const cookie = 'uglydex_session=' + token;
  const admin = await db().externalIdentity.findUniqueOrThrow({
    where: {
      provider_externalId: {
        provider: 'DISCORD',
        externalId: '333333333333333333',
      },
    },
  });
  const adminToken = randomBytes(32).toString('hex');
  await db().authSession.create({
    data: {
      collectorId: admin.collectorId,
      tokenHash: authHash(adminToken),
      expiresAt: new Date(Date.now() + 3600000),
    },
  });
  const post = (
    path: string,
    body: unknown,
    session = cookie,
    origin = process.env.PUBLIC_BASE_URL!,
  ) =>
    fetch(base + path, {
      method: 'POST',
      headers: {
        Cookie: session,
        Origin: origin,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  for (const path of [
    '/admin/production',
    '/admin/collectibles',
    '/admin/customs',
    '/admin/editions',
  ]) {
    check(
      (await fetch(base + path)).status === 404,
      'private admin anonymous ' + path,
    );
    check(
      (await fetch(base + path, { headers: { Cookie: cookie } })).status ===
        404,
      'ordinary user denied ' + path,
    );
    const r = await fetch(base + path, {
      headers: { Cookie: 'uglydex_session=' + adminToken },
    });
    check(r.ok, 'admin dashboard ' + path);
    check((await r.text()).includes('noindex'), 'admin noindex ' + path);
  }
  for (const path of ['/api/admin/production', '/api/admin/collectibles'])
    check(
      (await post(path, {})).status === 404,
      'ordinary user API denied ' + path,
    );
  check(
    (await fetch(base + '/api/admin/collectibles?kind=CUSTOM')).status === 404,
    'catalog export admin only',
  );
  const exported = await fetch(base + '/api/admin/collectibles?kind=CUSTOM', {
    headers: { Cookie: 'uglydex_session=' + adminToken },
  });
  check(
    exported.ok && !(await exported.text()).includes('PRIVATE_ADMIN_ID'),
    'safe catalog export HTTP',
  );
  check((await fetch(base + '/api/ready')).ok, 'migration readiness endpoint');
  check(
    (
      await post(
        '/api/admin/production',
        { service: 'blockchain', mode: 'DISABLED' },
        'uglydex_session=' + adminToken,
      )
    ).ok,
    'admin worker disable',
  );
  check(
    (
      await post(
        '/api/admin/production',
        { service: 'blockchain', mode: 'LIVE' },
        'uglydex_session=' + adminToken,
        'https://evil.invalid',
      )
    ).status === 400,
    'worker control origin checked',
  );
  const prefs = {
    PROFILE_THEME: 'theme-minimal',
    PROFILE_ACCENT: 'accent-bone',
    CARD_FRAME: 'frame-classic',
    GALLERY_STYLE: 'gallery-classic',
    SHARE_STYLE: 'share-clean',
  };
  check(
    (await post('/api/settings/appearance', prefs)).ok,
    'appearance API saves eligible choices',
  );
  check(
    (await post('/api/settings/appearance', { ...prefs, css: 'body{}' }))
      .status === 400,
    'appearance API rejects CSS',
  );
  check(
    (await post('/api/settings/appearance', prefs, '')).status === 401,
    'appearance requires auth',
  );
  check(
    (
      await post('/api/settings/display-art', {
        tokenId: 4307,
        key: 'phase7-live-custom',
      })
    ).ok,
    'owner Custom preference HTTP',
  );
  for (const path of [
    '/editions',
    '/editions/phase7-edition',
    '/editions/phase7-onchain',
    '/squig/4307',
    '/collector/phase7-collector',
    '/settings/appearance',
    '/collection/editions',
  ]) {
    const r = await fetch(base + path, { headers: { Cookie: cookie } });
    check(r.ok, 'phase7 route renders ' + path);
    const html = await r.text();
    check(
      !html.includes('PRIVATE_ADMIN_ID') &&
        !html.includes('PRIVATE_SOURCE_REFERENCE') &&
        !html.includes('PRIVATE_EDITION_SOURCE'),
      'phase7 no private provenance ' + path,
    );
  }
  const custom = '/api/share?kind=custom&entity=4307&key=phase7-live-custom';
  const customPage = await fetch(
    base + '/share?kind=custom&entity=4307&key=phase7-live-custom',
  );
  const customHtml = await customPage.text();
  check(
    customPage.ok &&
      customHtml.includes('og:image') &&
      customHtml.includes('OFFICIAL CUSTOM'),
    'Custom canonical share page and OG metadata',
  );
  check(
    customHtml.includes('Official Custom') &&
      !customHtml.includes('PRIVATE_SOURCE_REFERENCE'),
    'Custom share page artwork and privacy',
  );
  let response = await fetch(base + custom);
  check(
    response.ok && response.headers.get('content-type') === 'image/png',
    'Custom PNG endpoint',
  );
  const bytes = new Uint8Array(await response.arrayBuffer());
  check(bytes[0] === 137 && bytes[1] === 80, 'Custom real PNG signature');
  check(
    response.headers.get('cache-control')?.includes('no-store'),
    'Custom share privacy cache policy',
  );
  await db().squigCustom.update({
    where: { key: 'phase7-live-custom' },
    data: { status: 'DRAFT' },
  });
  check(
    (await fetch(base + custom)).status === 404,
    'cached Custom revoked after status change',
  );
  await db().squigCustom.update({
    where: { key: 'phase7-live-custom' },
    data: { status: 'VERIFIED' },
  });
  await db().squigEdition.update({
    where: { slug: 'phase7-edition' },
    data: { status: 'DRAFT' },
  });
  response = await fetch(base + '/editions/phase7-edition');
  const draftHtml = await response.text();
  check(
    (response.status === 404 || draftHtml.includes('noindex')) &&
      !draftHtml.includes('The Companion'),
    'draft Edition no personalized metadata',
  );
  await db().squigEdition.update({
    where: { slug: 'phase7-edition' },
    data: { status: 'VERIFIED' },
  });
  await db().collector.update({
    where: { id: c.id },
    data: { isPublic: false },
  });
  check(
    (await fetch(base + '/api/share?entity=phase7-collector')).status === 404,
    'personalization never bypasses profile privacy',
  );
  await db().collector.update({
    where: { id: c.id },
    data: { isPublic: true },
  });
  if (browserTests) {
    const { chromium } = await import('@playwright/test');
    const browser = await chromium.launch({ headless: true });
    try {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
      });
      await context.addCookies([
        { name: 'uglydex_session', value: token, url: base },
      ]);
      const page = await context.newPage();
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.route(base + '/api/**', async (route) => {
        const response = await route.fetch({
          headers: {
            ...(await route.request().allHeaders()),
            origin: process.env.PUBLIC_BASE_URL!,
          },
        });
        await route.fulfill({ response });
      });
      for (const width of [390, 360, 768]) {
        await page.setViewportSize({ width, height: 844 });
        for (const path of [
          '/settings/appearance',
          '/collector/phase7-collector',
          '/editions',
          '/editions/phase7-edition',
          '/collection/editions',
          '/squig/4307',
        ]) {
          await page.goto(base + path);
          await page.locator('h1').waitFor();
          check(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= window.innerWidth,
            ),
            'phase7 mobile overflow ' + width + ' ' + path,
          );
          check(
            (await page.locator('img:not([alt])').count()) === 0,
            'phase7 artwork alt text ' + path,
          );
        }
      }
      await page.goto(base + '/settings/appearance');
      await page
        .getByLabel('profile theme', { exact: true })
        .selectOption('theme-labs');
      await page.getByRole('button', { name: 'Save appearance' }).click();
      await page
        .getByRole('status')
        .filter({ hasText: 'Appearance saved.' })
        .waitFor();
      check(true, 'mobile appearance save end to end');
      check(
        await page
          .locator('[aria-label="Appearance preview"]')
          .getAttribute('class')
          .then((c) => c?.includes('theme-labs')),
        'appearance live preview',
      );
      await page.getByLabel('profile theme', { exact: true }).focus();
      await page.keyboard.press('Tab');
      check(
        await page
          .getByLabel('profile accent', { exact: true })
          .evaluate((element) => document.activeElement === element),
        'appearance keyboard focus',
      );
      await page.screenshot({
        path: '.data/phase7-appearance-mobile.png',
        fullPage: true,
      });
      await page.goto(base + '/editions/phase7-edition');
      await page.screenshot({
        path: '.data/phase7-edition-mobile.png',
        fullPage: true,
      });
      check(
        errors.length === 0,
        'phase7 no browser errors: ' + errors.join('; '),
      );
    } finally {
      await browser.close();
    }
  }
}
