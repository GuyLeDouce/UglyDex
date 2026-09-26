import { db } from '../../src/server/db';
import { authHash } from '../../src/server/auth';
import { rebuildSubject } from '../../src/server/progression-engine';
import { rebuildCollection } from '../../src/server/dex-engine';
import { progressionView } from '../../src/server/progression';
import { randomBytes, createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { RULESET } from '../../src/domain/progression';
import { COLLECTION_RULESET } from '../../src/domain/dex';
export async function phase6WebTests(
  base: string,
  check: (v: unknown, m: string) => void,
  browserTests: boolean,
) {
  const c = await db().collector.findUniqueOrThrow({
      where: { slug: 'sharing-test' },
    }),
    token = randomBytes(32).toString('hex');
  await db().authSession.create({
    data: {
      tokenHash: authHash(token),
      collectorId: c.id,
      expiresAt: new Date(Date.now() + 3600000),
    },
  });
  const cookie = 'uglydex_session=' + token;
  await rebuildCollection(c.id);
  await rebuildSubject('COLLECTOR', c.id);
  const progress = await progressionView('COLLECTOR', c.id);
  const earned =
    progress?.status === 'ready'
      ? progress.cards.filter((a) => a.unlocked)
      : [];
  await db().collector.update({
    where: { id: c.id },
    data: {
      featuredAchievementIds: earned
        .slice(0, 4)
        .map((a) => RULESET + ':' + a.key),
      featuredSetIds: [COLLECTION_RULESET + ':first-specimen'],
      selectedTitleId: earned.find((a) => a.title)
        ? RULESET + ':' + earned.find((a) => a.title)!.key
        : null,
    },
  });
  const post = (
    body: unknown,
    authenticated = true,
    origin = process.env.PUBLIC_BASE_URL,
  ) =>
    fetch(base + '/api/settings/galleries', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: origin!,
        ...(authenticated ? { Cookie: cookie } : {}),
      },
      body: JSON.stringify(body),
    });
  const input = {
    slug: 'web-exhibition',
    name: 'A Beautiful Disaster',
    description: 'Four walls. A few favourite freaks.',
    visibility: 'PUBLIC',
    layout: 'EXHIBITION',
    featured: true,
    items: [
      {
        tokenId: 4202,
        caption: '<script>window.GALLERY_XSS=1</script>',
        section: 'The first room',
      },
      { tokenId: 4203, caption: 'Still strange.', section: 'The first room' },
    ],
  };
  check((await post(input, false)).status === 401, 'gallery API requires auth');
  check(
    (await post(input, true, 'https://evil.invalid')).status === 400,
    'gallery API origin protection',
  );
  const created = await post(input);
  check(created.ok, 'gallery API create');
  const gallery = await created.json();
  const url = '/collector/sharing-test/gallery/web-exhibition';
  let response = await fetch(base + url);
  check(response.ok, 'public gallery HTTP');
  let html = await response.text();
  check(
    html.includes('A Beautiful Disaster') &&
      html.includes('og:image') &&
      html.includes('canonical'),
    'gallery canonical OG',
  );
  check(
    html.includes('property="og:title" content="A Beautiful Disaster"') &&
      html.includes(
        'name="description" content="Four walls. A few favourite freaks."',
      ) &&
      html.includes(
        'rel="canonical" href="' + process.env.PUBLIC_BASE_URL + url + '"',
      ) &&
      html.includes(
        'property="og:image" content="' +
          process.env.PUBLIC_BASE_URL +
          '/api/share?kind=gallery',
      ) &&
      html.includes('name="twitter:card" content="summary_large_image"'),
    'gallery exact public title, description, canonical URL and dynamic social image',
  );
  check(
    !html.includes('PRIVATE_EVIDENCE') && !html.includes(c.id),
    'gallery public HTML excludes internal evidence and IDs',
  );
  check(
    (await fetch(base + '/admin/sharing')).status === 404,
    'sharing diagnostics admin only',
  );
  check(
    (
      await fetch(
        base + '/api/share?entity=sharing-test&image=http://127.0.0.1',
      )
    ).status === 400,
    'share SSRF query rejected',
  );
  check(
    (await fetch(base + '/api/share?kind=squig&entity=4445')).status === 404,
    'invalid token image',
  );
  check(
    (await fetch(base + '/api/share?entity=sharing-private')).status === 404,
    'private card endpoint',
  );
  for (const kind of [
    'collector',
    'completion',
    'trophy',
    'collage',
    'squig',
    'passport',
    'gallery',
    'set',
    'achievement',
  ]) {
    const p = await progressionView('COLLECTOR', c.id);
    const achievement =
      p?.status === 'ready' ? p.cards.find((a) => a.unlocked)?.key : undefined;
    const params = new URLSearchParams({
      kind,
      entity: ['squig', 'passport'].includes(kind) ? '4202' : 'sharing-test',
      ...(kind === 'gallery'
        ? { key: 'web-exhibition' }
        : kind === 'set'
          ? { key: 'first-specimen' }
          : kind === 'achievement'
            ? { key: achievement! }
            : {}),
    });
    response = await fetch(base + '/api/share?' + params);
    check(response.ok, 'render endpoint ' + kind);
    const bytes = Buffer.from(await response.arrayBuffer());
    check(
      bytes
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
      'PNG endpoint ' + kind,
    );
    check(
      response.headers.get('cache-control')?.includes('no-store'),
      'private cache policy ' + kind,
    );
    if (kind === 'squig' || kind === 'collage')
      await writeFile('.data/phase6-' + kind + '-live.png', bytes);
  }
  response = await fetch(
    base + '/api/share?entity=sharing-test&download=1&ratio=square',
  );
  check(
    response.headers.get('content-disposition')?.includes('attachment'),
    'PNG download attachment',
  );
  await db().collector.update({
    where: { id: c.id },
    data: { isPublic: false },
  });
  check(
    (await fetch(base + '/api/share?entity=sharing-test')).status === 404,
    'cached image revoked after profile private',
  );
  check(
    (await fetch(base + url)).status === 404,
    'private profile hides gallery route',
  );
  html = await (await fetch(base + '/collector/sharing-test')).text();
  check(
    html.includes('noindex') && !html.includes(c.displayName!),
    'private profile metadata omits personalized identity',
  );
  response = await fetch(base + '/api/share?entity=sharing-test&preview=1', {
    headers: { Cookie: cookie },
  });
  check(response.ok, 'authenticated private card preview');
  check(
    (await fetch(base + '/api/share?entity=sharing-test&preview=1')).status ===
      404,
    'anonymous cannot request private preview',
  );
  await db().collector.update({
    where: { id: c.id },
    data: { isPublic: true },
  });
  await db().collectorGallery.update({
    where: { id: gallery.id },
    data: { visibility: 'PRIVATE' },
  });
  check(
    (
      await fetch(
        base + '/api/share?kind=gallery&entity=sharing-test&key=web-exhibition',
      )
    ).status === 404,
    'cached gallery image revoked after privacy transition',
  );
  await db().collectorGallery.update({
    where: { id: gallery.id },
    data: { visibility: 'UNLISTED' },
  });
  html = await (await fetch(base + url)).text();
  check(html.includes('noindex'), 'unlisted gallery noindex');
  check(
    (
      await fetch(
        base + '/api/share?kind=gallery&entity=sharing-test&key=web-exhibition',
      )
    ).ok,
    'unlisted gallery image direct URL',
  );
  await db().collectorGallery.update({
    where: { id: gallery.id },
    data: { visibility: 'PUBLIC' },
  });
  await db().collector.update({
    where: { id: c.id },
    data: { collectionVisibility: 'HIDDEN' },
  });
  html = await (
    await fetch(base + '/collector/sharing-test/collection')
  ).text();
  check(
    html.includes('keeps their collection private'),
    'hidden collection page',
  );
  response = await fetch(base + '/api/share?entity=sharing-test', {
    headers: { Cookie: cookie },
  });
  check(
    response.ok,
    'signed-in public card keeps the same projection during final privacy check',
  );
  response = await fetch(base + '/api/share?entity=sharing-test&preview=1', {
    headers: { Cookie: cookie },
  });
  check(response.ok, 'owner explicitly previews hidden collection artwork');
  await db().collector.update({
    where: { id: c.id },
    data: { collectionVisibility: 'FULL' },
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
      // Test server is loopback HTTP; production origin stays HTTPS. Foreign origins are tested above.
      await page.route(base + '/api/**', async (route) => {
        const response = await route.fetch({
          headers: {
            ...(await route.request().allHeaders()),
            origin: process.env.PUBLIC_BASE_URL!,
          },
        });
        await route.fulfill({ response });
      });
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      for (const path of [
        '/collector/sharing-test',
        url,
        '/share?kind=collage&entity=sharing-test',
        '/share?kind=set&entity=sharing-test&key=first-specimen',
        '/squig/4202',
      ]) {
        await page.goto(base + path);
        await page.locator('h1').waitFor();
        check(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
          'mobile no overflow ' + path,
        );
        if (path === url) {
          check(
            !(await page.evaluate(() => Reflect.get(window, 'GALLERY_XSS'))),
            'gallery captions cannot execute HTML',
          );
          await page.screenshot({
            path: '.data/phase6-gallery-mobile.png',
            fullPage: true,
          });
        }
      }
      await page.goto(base + '/squig/4202');
      await page.getByRole('button', { name: 'Share ↗', exact: true }).click();
      await page
        .getByRole('img', { name: 'UglyDex share card preview' })
        .waitFor();
      check(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
        'mobile share panel fits',
      );
      await page.evaluate(
        "Object.defineProperty(navigator,'share',{configurable:true,value:async function(payload){window.nativeSharePayload={url:payload.url,text:payload.text};}})",
      );
      await page
        .getByRole('button', { name: 'Share link', exact: true })
        .click();
      check(
        await page.evaluate(() =>
          String(Reflect.get(window, 'nativeSharePayload')?.url).endsWith(
            '/squig/4202',
          ),
        ),
        'native share receives canonical public URL',
      );
      const downloaded = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Download PNG' }).click();
      check(
        (await downloaded).suggestedFilename() === 'uglydex.png',
        'browser PNG download',
      );
      // A string keeps tsx's function-name helpers out of the browser realm.
      await page.evaluate(`
        Object.defineProperty(navigator, 'canShare', { configurable: true, value: function() { return true; } });
        Object.defineProperty(navigator, 'share', {
          configurable: true,
          value: async function(payload) {
            window.nativeFilePayload = {
              count: payload.files?.length,
              type: payload.files?.[0]?.type,
              active: navigator.userActivation.isActive,
            };
          },
        });
      `);
      await page
        .getByRole('button', { name: 'Prepare image to share', exact: true })
        .click();
      await page
        .getByRole('button', { name: 'Share image', exact: true })
        .click();
      check(
        await page.evaluate(() => {
          const payload = Reflect.get(window, 'nativeFilePayload');
          return (
            payload?.count === 1 &&
            payload?.type === 'image/png' &&
            payload?.active
          );
        }),
        'native PNG share runs from an active user gesture',
      );
      await page.screenshot({
        path: '.data/phase6-share-mobile.png',
        fullPage: true,
      });
      await page.goto(base + '/settings/galleries');
      await page
        .getByLabel('Gallery name', { exact: true })
        .fill('Mobile Freaks');
      await page
        .getByLabel('Gallery slug', { exact: true })
        .fill('mobile-freaks');
      await page.getByLabel('Add Squig', { exact: true }).fill('4202');
      await page
        .getByRole('button', { name: 'Add Squig', exact: true })
        .click();
      check(
        await page
          .locator('.settings-form')
          .evaluate((form) => (form as HTMLFormElement).checkValidity()),
        'gallery editor native validity',
      );
      const saveResponse = page.waitForResponse(
        (r) =>
          r.url() === base + '/api/settings/galleries' &&
          r.request().method() === 'POST',
      );
      await page
        .getByRole('button', { name: 'Save gallery', exact: true })
        .click();
      const saveResult = await saveResponse;
      check(
        saveResult.ok(),
        'gallery editor response ' +
          saveResult.status() +
          ' ' +
          (await saveResult.text()),
      );
      await page.screenshot({
        path: '.data/phase6-editor-debug.png',
        fullPage: true,
      });
      await page.waitForURL(/settings\/galleries\?edit=/);
      await page
        .getByRole('button', { name: 'Delete gallery', exact: true })
        .waitFor();
      check(true, 'mobile gallery editor saves');
      await page.getByLabel('Add Squig', { exact: true }).fill('4203');
      await page
        .getByRole('button', { name: 'Add Squig', exact: true })
        .click();
      await page
        .getByRole('button', { name: 'Move Squig 4203 up', exact: true })
        .click();
      check(
        (
          await page.locator('.gallery-edit-list li').first().textContent()
        )?.includes('Squig #4203'),
        'accessible gallery ordering',
      );
      const reordered = page.waitForResponse(
        (r) =>
          r.url() === base + '/api/settings/galleries' &&
          r.request().method() === 'POST',
      );
      await page
        .getByRole('button', { name: 'Save gallery', exact: true })
        .click();
      check((await reordered).ok(), 'keyboard reordered gallery persists');
      await page.goto(base + '/settings/sharing');
      await page.getByLabel('Card', { exact: true }).selectOption('collage');
      await page.getByRole('button', { name: 'Share ↗', exact: true }).click();
      check(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
        'mobile collage studio fits',
      );
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.goto(base + url);
      await page.screenshot({
        path: '.data/phase6-gallery-desktop.png',
        fullPage: true,
      });
      await page.goto(base + '/collector/sharing-test');
      await page.screenshot({
        path: '.data/phase6-showcase-desktop.png',
        fullPage: true,
      });
      for (const width of [320, 390, 768]) {
        await page.setViewportSize({ width, height: 844 });
        await page.goto(base + '/collector/sharing-test');
        check(
          await page
            .getByRole('heading', { name: 'The trophy case.', exact: true })
            .isVisible(),
          'earned trophy case visible at width ' + width,
        );
        check(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          'showcase fits width ' + width,
        );
        if (width === 390)
          await page.screenshot({
            path: '.data/phase6-showcase-mobile.png',
            fullPage: true,
          });
      }
      for (const layout of ['GRID', 'COMPACT'] as const) {
        await db().collectorGallery.update({
          where: { id: gallery.id },
          data: { layout },
        });
        await page.setViewportSize({ width: 320, height: 844 });
        await page.goto(base + url);
        check(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          'gallery layout fits narrow mobile ' + layout,
        );
      }
      check(errors.length === 0, 'Phase6 browser has no runtime errors');
      await context.close();
    } finally {
      await browser.close();
    }
  }
  const bucket = Math.floor(Date.now() / 60000);
  const keys = [bucket, bucket + 1].map((n) =>
    createHash('sha256')
      .update('share:global:' + n)
      .digest('hex'),
  );
  for (const key of keys)
    await db().rateLimitBucket.upsert({
      where: { key },
      create: { key, count: 120, expiresAt: new Date(Date.now() + 120000) },
      update: { count: 120 },
    });
  response = await fetch(base + '/api/share?entity=sharing-test');
  check(
    response.status === 429 && response.headers.get('retry-after') === '60',
    'share endpoint enforces shared rate budget with retry guidance',
  );
  await db().rateLimitBucket.deleteMany({ where: { key: { in: keys } } });
  const admin = await db().externalIdentity.findFirstOrThrow({
    where: { externalId: '333333333333333333', authenticatedAt: { not: null } },
    select: { collectorId: true },
  });
  const adminToken = randomBytes(32).toString('hex');
  await db().authSession.create({
    data: {
      tokenHash: authHash(adminToken),
      collectorId: admin.collectorId,
      expiresAt: new Date(Date.now() + 60000),
    },
  });
  response = await fetch(
    base + '/admin/sharing?kind=collector&entity=sharing-test',
    {
      headers: { Cookie: 'uglydex_session=' + adminToken },
    },
  );
  html = await response.text();
  check(
    response.ok &&
      html.includes('Recent render health') &&
      html.includes('Open permitted PNG') &&
      html.includes('noindex'),
    'authenticated sharing diagnostics and public preview tool',
  );
}
