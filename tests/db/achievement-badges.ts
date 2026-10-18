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
      displayName: 'Badge Review Collector',
      isPublic: true,
    },
  });
  await db().externalIdentity.create({
    data: {
      collectorId: c.id,
      provider: 'DISCORD',
      externalId: '899999999999999998',
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
      card?.achievementBadges?.length === 3 &&
        card.achievementBadges.every((b) => card.badges.includes(b.name)),
      `${kind} share captions match the selected badge artwork`,
    );
  }
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
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const paths = [
      ['/me/achievements', 'achievements', 43],
      ['/squig/4398', 'squig-detail', 22],
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
          check(
            await focus.locator('.achievement-tooltip').isVisible(),
            `${name} tooltip is keyboard accessible`,
          );
        }
        if (name === 'squig-card') {
          const card = page.locator('.squig-card[href="/squig/4398"]');
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
            .locator('.squig-card[href="/squig/4398"]')
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
