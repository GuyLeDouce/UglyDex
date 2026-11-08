import { db } from '../../src/server/db';
import {
  rebuildSubject,
  seedProgression,
} from '../../src/server/progression-engine';
import { progressionView } from '../../src/server/progression';
import { squigBadgeSummaries } from '../../src/server/achievement-badges';
import { importRecord } from '../../src/sync/import-event';
import { duelEvents } from '../../src/integrations/uglybot/duels';
import { SQUIGS_CONTRACT } from '../../src/domain/validation';
import { RULESET } from '../../src/domain/progression';
import { authHash } from '../../src/server/auth';
import { shareCard } from '../../src/server/sharing';
import { squigArtwork } from '../../src/domain/assets';
import catalog from '../../data/squigs.json';
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

export async function achievementBadgeWebTests(
  base: string,
  check: (v: unknown, m: string) => void,
  browserTests: boolean,
) {
  console.log(JSON.stringify({ event: 'test.badges.start' }));
  await seedProgression();
  const c = await db().collector.create({
    data: {
      slug: 'badge-review',
      showUsername: true,
      displayName: 'Badge Review Collector',
      isPublic: true,
    },
  });
  await db().externalIdentity.create({
    data: {
      collectorId: c.id,
      provider: 'DISCORD',
      externalId: '899999999999999998',
      // This fixture signs in below and represents a claimed collector.
      authenticatedAt: new Date(),
    },
  });
  const canonical = catalog.records.find((r) => r.tokenId === 4398)!;
  const specimen = {
    name: canonical.name,
    imageUrl: squigArtwork(4398),
    uglyPoints: canonical.uglyPoints,
    mawRank: canonical.mawRank,
    rarityTier: canonical.rarityTier,
    og: canonical.og,
    legendary: canonical.legendary,
  };
  const s = await db().squig.upsert({
    where: {
      chainId_contractAddress_tokenId: {
        chainId: 1,
        contractAddress: SQUIGS_CONTRACT,
        tokenId: 4398,
      },
    },
    create: {
      chainId: 1,
      contractAddress: SQUIGS_CONTRACT,
      tokenId: 4398,
      ...specimen,
    },
    update: specimen,
  });
  for (const [traitType, value] of Object.entries(canonical.traits)) {
    await db().squigTrait.upsert({
      where: { squigId_traitType: { squigId: s.id, traitType } },
      create: { squigId: s.id, traitType, value },
      update: { value },
    });
  }
  for (let i = 0; i < 25; i++) {
    const id = `badge-review-duel-${i}`;
    await importRecord(
      'duels',
      id,
      duelEvents({
        id,
        challenger_id: '899999999999999998',
        challenger_squig_token_id: 4398,
        status: 'completed',
        winner_id: '899999999999999998',
        completed_at: new Date(Date.UTC(2026, 0, i + 1)),
        created_at: new Date(Date.UTC(2026, 0, i + 1)),
        wager_amount: '0',
      }),
    );
  }
  await rebuildSubject('COLLECTOR', c.id);
  await rebuildSubject('SQUIG', s.id);
  const before = await db().squigProgress.findUniqueOrThrow({
    where: { squigId: s.id },
  });
  const p = await progressionView('COLLECTOR', c.id, true);
  check(
    p?.status === 'ready' && p.badgeSummary.badges.length === 5,
    'badge Collector projection contains five earned account awards',
  );
  check(
    !JSON.stringify(p).includes('Furniture') &&
      !JSON.stringify(p).includes('furniture.png'),
    'secret metadata and image omitted from public projection',
  );
  const summary = (await squigBadgeSummaries([s.id])).get(s.id)!;
  for (const [kind, entity] of [
    ['collector', c.slug],
    ['squig', '4398'],
  ] as const) {
    const card = await shareCard({ kind, entity });
    check(
      card?.achievementBadges?.length === (kind === 'collector' ? 2 : 3) &&
        card.achievementBadges.every((b) => card.badges.includes(b.name)),
      `${kind} share captions match the selected badge artwork`,
    );
  }
  const selectedCard = await shareCard({
    kind: 'collector',
    entity: c.slug,
    achievements: 'collector-wins-25',
  });
  check(
    selectedCard?.achievementBadges?.length === 1 &&
      selectedCard.achievementBadges[0].key === 'collector-wins-25' &&
      selectedCard.badges.includes('Certified Menace') &&
      !selectedCard.badges.includes('Battle Regular'),
    'explicit collector selection controls artwork and captions together',
  );
  check(
    summary.status === 'ready' &&
      summary.badges.length === 7 &&
      summary.badges.every((b) => b.subject === 'SQUIG'),
    'batch read returns seven token-bound Squig awards',
  );
  await db().progressionJob.create({
    data: { subjectType: 'SQUIG', subjectId: s.id },
  });
  check(
    (await squigBadgeSummaries([s.id])).get(s.id)?.status === 'pending',
    'queued reevaluation withholds stale card awards',
  );
  await rebuildSubject('SQUIG', s.id);
  check(
    (await db().squigProgress.findUniqueOrThrow({ where: { squigId: s.id } }))
      .xp === before.xp,
    'badge reads do not change Squig XP',
  );
  const token = randomBytes(32).toString('hex');
  await db().collector.update({
    where: { id: c.id },
    data: { onboardingCompletedAt: new Date() },
  });
  await db().authSession.create({
    data: {
      collectorId: c.id,
      tokenHash: authHash(token),
      expiresAt: new Date(Date.now() + 3600000),
    },
  });
  const secretUrl =
    base + '/api/achievement-badges/collector-systems-7?collector=' + c.id;
  check(
    (await fetch(secretUrl)).status === 404,
    'locked secret image denied anonymously',
  );
  check(
    (
      await fetch(secretUrl, {
        headers: { Cookie: 'uglydex_session=' + token },
      })
    ).status === 404,
    'locked secret image denied even to owner',
  );
  check(
    (await fetch(base + '/achievements/collector/part-of-the-furniture.png'))
      .status === 404,
    'secret artwork is not a public static asset',
  );
  const secret = await db().collectorAchievement.findUniqueOrThrow({
    where: {
      collectorId_achievementId: {
        collectorId: c.id,
        achievementId: RULESET + ':collector-systems-7',
      },
    },
  });
  // Access-control fixture only: production evaluators and requirements stay untouched.
  await db().collectorAchievement.update({
    where: {
      collectorId_achievementId: {
        collectorId: c.id,
        achievementId: secret.achievementId,
      },
    },
    data: {
      revokedAt: null,
      awardedAt: new Date('2026-02-01'),
      gateSatisfied: true,
    },
  });
  const unlockedResponse = await fetch(secretUrl);
  const optimizer =
    base +
    '/_next/image?url=' +
    encodeURIComponent(
      '/api/achievement-badges/collector-systems-7?collector=' + c.id,
    ) +
    '&w=96&q=75';
  check(
    (await fetch(optimizer)).status === 400,
    'protected secret cannot enter the shared Next image cache',
  );
  check(
    unlockedResponse.ok &&
      unlockedResponse.headers.get('cache-control') === 'private, no-store',
    'earned public secret is served without shared caching',
  );
  check(
    (await sharp(Buffer.from(await unlockedResponse.arrayBuffer())).metadata())
      .hasAlpha,
    'protected secret PNG retains transparency',
  );
  await db().collector.update({
    where: { id: c.id },
    data: { isPublic: false },
  });
  check(
    (await fetch(secretUrl)).status === 404,
    'secret image revoked after profile becomes private',
  );
  check(
    (
      await fetch(secretUrl, {
        headers: { Cookie: 'uglydex_session=' + token },
      })
    ).ok,
    'earned private secret available to authenticated owner',
  );
  await db().collectorAchievement.update({
    where: {
      collectorId_achievementId: {
        collectorId: c.id,
        achievementId: secret.achievementId,
      },
    },
    data: {
      revokedAt: secret.revokedAt,
      awardedAt: secret.awardedAt,
      gateSatisfied: secret.gateSatisfied,
    },
  });
  await db().collector.update({
    where: { id: c.id },
    data: { isPublic: true },
  });
  if (!browserTests) return;
  await mkdir('.data/badges', { recursive: true });
  for (const ratio of ['landscape', 'square']) {
    const exported = await fetch(
      base +
        '/api/share?kind=achievement&entity=badge-review&key=collector-wins-25&ratio=' +
        ratio,
    );
    check(exported.ok, `earned achievement ${ratio} export succeeds`);
    const bytes = Buffer.from(await exported.arrayBuffer());
    const metadata = await sharp(bytes).metadata();
    check(
      metadata.width === (ratio === 'square' ? 1080 : 1200) &&
        metadata.height === (ratio === 'square' ? 1080 : 630),
      `achievement ${ratio} export preserves existing dimensions`,
    );
    await writeFile(`.data/badges/export-${ratio}.png`, bytes);
  }
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({ headless: true });
  await mkdir('.data/badges', { recursive: true });
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    await context.addCookies([
      { name: 'uglydex_session', value: token, url: base },
    ]);
    const page = await context.newPage();
    await page.goto(base + '/squigs/listings?sort=rank&dex=traits', {
      waitUntil: 'domcontentloaded',
    });
    check(
      (await page.getByLabel('My field guide').inputValue()) === 'traits' &&
        (await page.getByLabel('Sort', { exact: true }).inputValue()) ===
          'rank',
      'signed-in listings retain Field Guide and metric filter selections',
    );
    await page.getByLabel('My field guide').selectOption('advances');
    await page.getByRole('button', { name: 'Apply filters' }).click();
    await page.waitForURL(/dex=advances/);
    check(
      (await page.getByLabel('My field guide').inputValue()) === 'advances' &&
        (await page.getByLabel('Sort', { exact: true }).inputValue()) ===
          'rank',
      'listing Field Guide filter submits without losing metric sort',
    );
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const paths = [
      ['/me/achievements', 'achievements', 43],
      ['/squig/4398', 'squig-detail', 0],
      ['/squig/4398/achievements', 'squig-achievements', 22],
      ['/collector/badge-review', 'collector-card', 0],
      ['/collector/badge-review/achievements', 'collector-achievements', 43],
      ['/squigs?q=4398', 'squig-card', 0],
      [
        '/share?kind=achievement&entity=badge-review&key=collector-wins-25',
        'achievement-share',
        0,
      ],
    ] as const;
    const evidence: object[] = [];
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: width > 1000 ? 1000 : 844 });
      for (const [path, name, cardCount] of paths) {
        // External NFT artwork may keep requests open. Wait for the tested
        // content explicitly; badge decoding is checked below for every image.
        await page.goto(base + path, { waitUntil: 'domcontentloaded' });
        if (name === 'squig-detail') {
          check(
            await page.locator('#achievements').isVisible(),
            'Squig earned progression is visible on its Passport',
          );
          check(
            (await page
              .getByRole('link', { name: 'View achievements →', exact: true })
              .getAttribute('href')) === '/squig/4398/achievements',
            'complete Squig achievement catalogue remains one click away',
          );
        }
        if (name === 'collector-card') {
          check(
            (await page.locator('.trophy-case .achievement-badge').count()) > 0,
            'earned trophies appear without manual featuring',
          );
        }
        if (name === 'squig-card') {
          const card = page.locator('.album-card').first();
          await card.waitFor();
          const bounds = await card.boundingBox();
          if (width <= 600)
            check(
              bounds && bounds.width > width * 0.8,
              'mobile grid gives each card readable full-row width',
            );
          check(
            (await card
              .locator('.trading-face-inner > .album-progress')
              .count()) === 1,
            'discovery context belongs inside the card frame',
          );
          check(
            (await card.locator('a a, a button, a summary').count()) === 0,
            'card actions do not nest inside navigation links',
          );
          check(
            await card
              .locator('.card-record-links .achievement-strip')
              .isVisible(),
            'earned badges remain visible while Details is collapsed',
          );
          await card.screenshot({ path: `.data/mobile-card-${width}.png` });
        }
        for (const details of await page.locator('.card-details').all()) {
          check(
            (await details.getAttribute('open')) === null,
            'card details start collapsed',
          );
          await details.locator('summary').click();
        }
        await page.locator('.achievement-badge img').first().waitFor();
        if (cardCount)
          check(
            (await page.locator('.achievement-grid .achievement').count()) ===
              cardCount,
            `${name} exposes the correct complete catalog at ${width}px`,
          );
        check(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
          `${name} has no horizontal overflow at ${width}px`,
        );
        check(
          !(await page.locator('body').innerText()).includes(
            'Part of the Furniture',
          ),
          `${name} keeps locked secret name hidden`,
        );
        // Scroll the full page to exercise lazy badge loading before checking decoded images.
        for (const image of await page.locator('.achievement-badge img').all())
          await image.scrollIntoViewIfNeeded();
        await page.waitForFunction(() =>
          Array.from(
            document.querySelectorAll<HTMLImageElement>(
              '.achievement-badge img',
            ),
          ).every((i) => i.complete && i.naturalWidth > 0),
        );
        check(
          (await page.locator('.achievement-badge img').count()) > 0,
          `${name} displays approved artwork at ${width}px`,
        );
        const hovered = page.locator('.achievement-badge').first();
        await hovered.hover();
        await page.getByRole('tooltip').waitFor();
        check(
          (await page.getByRole('tooltip').innerText()) ===
            (await hovered.getAttribute('aria-label')),
          `${name} hover identifies the badge and status at ${width}px`,
        );
        const tooltip = await page.getByRole('tooltip').boundingBox();
        check(
          tooltip &&
            tooltip.x >= 0 &&
            tooltip.x + tooltip.width <= width &&
            tooltip.y >= 0,
          `${name} tooltip stays within the viewport`,
        );
        await page.keyboard.press('Escape');
        check(
          (await page.getByRole('tooltip').count()) === 0,
          `${name} tooltip dismisses with Escape`,
        );
        if (cardCount) {
          const locked = page
            .locator(
              '.achievement-badge--pending img, .achievement-badge--locked img',
            )
            .first();
          check(
            (await locked.evaluate((i) => getComputedStyle(i).filter)).includes(
              'grayscale(1)',
            ),
            `${name} locked badges are grayscale`,
          );
          const earned = page.locator('.achievement-badge--earned img').first();
          check(
            (await earned.evaluate((i) => getComputedStyle(i).filter)) ===
              'none',
            `${name} earned badges remain full colour`,
          );
          const focus = page
            .locator('.achievement-grid .achievement-badge[tabindex="0"]')
            .first();
          await focus.focus();
          await page.getByRole('tooltip').waitFor();
          check(
            await page.getByRole('tooltip').isVisible(),
            `${name} tooltip is keyboard accessible`,
          );
        }
        if (name === 'squig-card') {
          const card = page
            .locator('.squig-card')
            .filter({ has: page.locator('a[href="/squig/4398"]') });
          check(
            (await card.locator('.achievement-badge').count()) === 3 &&
              (await card.innerText()).includes('+4'),
            'Squig card renders three earned badges and accurate +4',
          );
          check(
            await card
              .locator('.achievement-badge img')
              .evaluateAll((images) =>
                images.every((i) =>
                  (i as HTMLImageElement).src.includes('squig'),
                ),
              ),
            'Squig card images belong to Squig catalog',
          );
        }
        if (name === 'collector-card') {
          check(
            (await page
              .locator('.showcase-level .achievement-badge')
              .count()) === 3 &&
              (await page.locator('.showcase-level').innerText()).includes(
                '+2',
              ),
            'Collector card renders three earned badges and accurate +2',
          );
        }
        await page.evaluate(() => {
          (document.activeElement as HTMLElement)?.blur();
          window.scrollTo(0, 0);
        });
        if (width !== 320)
          await page.screenshot({
            path: `.data/badges/${name}-${width}.png`,
            fullPage: true,
          });
        if (width === 1440 && name === 'squig-card')
          await page
            .locator('.squig-card')
            .filter({ has: page.locator('a[href="/squig/4398"]') })
            .screenshot({ path: '.data/badges/squig-card-closeup.png' });
        if (width === 1440 && name === 'achievements')
          await page
            .locator('.achievement-grid')
            .nth(1)
            .screenshot({ path: '.data/badges/achievement-grid-closeup.png' });
        console.log(JSON.stringify({ event: 'test.badges.page', path, width }));
        evidence.push({
          path,
          width,
          catalogCards: cardCount,
          images: await page.locator('.achievement-badge img').count(),
          overflow: false,
        });
      }
    }
    // Review the real frontend with isolated identities; no production records.
    await mkdir('.data/design', { recursive: true });
    for (const width of [360, 390, 430, 768, 1440]) {
      await page.setViewportSize({ width, height: width > 1000 ? 1000 : 900 });
      for (const [route, name] of [
        ['/squigs?q=4398', 'explorer'],
        ['/squig/4398', 'passport'],
        ['/collector/badge-review', 'collector'],
        ['/collection', 'my-collection'],
        ['/settings/profile', 'settings'],
        ['/share?kind=passport&entity=4398', 'share'],
        ['/collectors', 'leaderboard'],
        ['/thread', 'thread'],
      ]) {
        await page.goto(base + route, { waitUntil: 'domcontentloaded' });
        await page.evaluate(() => document.fonts.ready);
        await page.waitForFunction(
          () =>
            Array.from(document.images)
              .filter((img) => {
                const r = img.getBoundingClientRect();
                return r.top < innerHeight && r.bottom > 0;
              })
              .every((img) => img.complete),
          { timeout: 30000 },
        );
        check(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
          `field guide ${name} fits ${width}px`,
        );
        if (name === 'share') {
          await page.locator('.share-controls > button').click();
          await page.locator('.share-panel').waitFor({ state: 'visible' });
          await page
            .locator('.share-preview')
            .waitFor({ state: 'visible', timeout: 60000 });
          await page.locator('.share-panel').scrollIntoViewIfNeeded();
          await page.waitForFunction(() =>
            Array.from(
              document.querySelectorAll<HTMLImageElement>('.share-preview'),
            ).every((img) => img.complete && img.naturalWidth > 0),
          );
        }
        if (name === 'settings') {
          check(
            await page
              .locator(
                '.settings-form input, .settings-form textarea, .settings-form select',
              )
              .evaluateAll((controls) =>
                controls.every((control) => {
                  const r = control.getBoundingClientRect();
                  return !r.width || (r.left >= 0 && r.right <= innerWidth);
                }),
              ),
            `settings controls remain visible at ${width}px`,
          );
        }
        if (name === 'explorer') {
          const filters = page.locator('.more-filters');
          check(
            (await filters.getAttribute('open')) === null,
            'advanced filters start compact when inactive',
          );
          await filters.locator('summary').click();
          const traitFilter = filters.locator('select[name="trait"]');
          await traitFilter.waitFor({ state: 'visible' });
          check(
            await traitFilter.isVisible(),
            'advanced trait filters remain accessible',
          );
          await filters.locator('summary').click();
        }
        if (name === 'passport' || name === 'collector') {
          const record = page.locator(
            name === 'passport' ? '#achievements' : '.trophy-case',
          );
          await record.scrollIntoViewIfNeeded();
          await page.waitForFunction(() =>
            Array.from(
              document.querySelectorAll<HTMLImageElement>(
                '.achievement-badge img',
              ),
            )
              .filter((img) => {
                const r = img.getBoundingClientRect();
                return r.top < innerHeight && r.bottom > 0;
              })
              .every((img) => img.complete && img.naturalWidth > 0),
          );
          await page.screenshot({
            path: `.data/design/history-${name}-${width}.png`,
          });
          await page.evaluate(() => window.scrollTo(0, 0));
        }
        await page.screenshot({
          path: `.data/design/${name}-${width}.png`,
          fullPage: false,
        });
      }
    }
    await context.clearCookies();
    for (const width of [360, 390, 430, 768, 1440]) {
      await page.setViewportSize({ width, height: width > 1000 ? 1000 : 900 });
      await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForFunction(
        () =>
          Array.from(document.images)
            .filter((img) => {
              const rect = img.getBoundingClientRect();
              return (
                rect.top < innerHeight &&
                rect.bottom > 0 &&
                rect.left < innerWidth &&
                rect.right > 0
              );
            })
            .every((img) => img.complete),
        { timeout: 30000 },
      );
      check(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        `public homepage fits ${width}px`,
      );
      check(
        await page
          .getByRole('link', { name: 'Explore the Squigs' })
          .isVisible(),
        'public discovery remains the primary homepage action',
      );
      await page.locator('.home-card-shelf').scrollIntoViewIfNeeded();
      await page.waitForFunction(() =>
        Array.from(
          document.querySelectorAll<HTMLImageElement>('.home-card-shelf img'),
        )
          .filter((img) => img.getBoundingClientRect().width > 0)
          .every((img) => img.complete && img.naturalWidth > 0),
      );
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: `.data/design/home-${width}.png`,
        fullPage: true,
      });
    }
    check(errors.length === 0, 'badge browser flows have no runtime errors');
    await writeFile(
      '.data/badges/browser-evidence.json',
      JSON.stringify({ evidence, errors }, null, 2),
    );
    await context.request.dispose();
  } finally {
    await browser.close();
  }
}
