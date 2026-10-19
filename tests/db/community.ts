import { db } from '../../src/server/db';
import { collectorThread, topCollectors } from '../../src/server/community';
import { dexView } from '../../src/server/dex';
import { progressionView } from '../../src/server/progression';
import { achievements, RULESET } from '../../src/domain/progression';
import { COLLECTION_RULESET, completion } from '../../src/domain/dex';
import { collectionSets, traitCatalog } from '../../src/domain/dex-catalog';
import { authHash } from '../../src/server/auth';
import { randomBytes } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';

export async function communityTests(
  base: string,
  check: (v: unknown, m: string) => void,
  browserTests: boolean,
) {
  const historicalTotal = collectionSets.filter(
    (s) => !s.hidden && s.mode === 'HISTORICAL_DISCOVERY',
  ).length;
  const create = async (slug: string, discovered: number, isPublic = true) => {
    const c = await db().collector.create({
      data: { slug, displayName: slug + ' Collector', isPublic },
    });
    const overall = completion(
      discovered,
      traitCatalog.length,
      traitCatalog.length,
      historicalTotal,
      historicalTotal,
    ).overall;
    await db().collectionSnapshot.create({
      data: {
        ruleset: COLLECTION_RULESET,
        collectorId: c.id,
        discovered,
        traits: traitCatalog.length,
        historicalSets: historicalTotal,
        currentSets: 0,
        overall,
        discoveredTokenIds: [],
        currentTokenIds: [],
        candidates: {},
      },
    });
    await db().collectorProgress.create({
      data: { collectorId: c.id, rulesVersion: RULESET, xp: 1000n, level: 4 },
    });
    // The database queues new collectors automatically. These explicit fixture
    // projections represent completed evaluations; only `pending` stays queued.
    await db().collectionJob.deleteMany({ where: { collectorId: c.id } });
    await db().progressionJob.deleteMany({
      where: { subjectType: 'COLLECTOR', subjectId: c.id },
    });
    return c;
  };
  const winner = await create('community-first', 4444);
  const tied = await create('community-second', 4444);
  const lower = await create('community-third', 1000);
  const privateC = await create('community-private', 4444, false);
  const pending = await create('community-pending', 4444);
  await db().collectionJob.create({ data: { collectorId: pending.id } });
  const ranked = await topCollectors();
  const first = ranked.collectors.find((c) => c.slug === winner.slug)!;
  const second = ranked.collectors.find((c) => c.slug === tied.slug)!;
  const third = ranked.collectors.find((c) => c.slug === lower.slug)!;
  const dex = await dexView(winner.id, true);
  check(
    dex?.status === 'ready' && first.overall === dex.score.overall,
    'leaderboard uses the exact public Field Guide percentage',
  );
  check(
    first.rank === second.rank && third.rank > first.rank,
    'equal completion shares a rank and lower scores follow',
  );
  check(
    ranked.collectors.indexOf(first) < ranked.collectors.indexOf(second),
    'leaderboard ties use a stable slug order',
  );
  check(
    !ranked.collectors.some((c) =>
      [privateC.slug, pending.slug].includes(c.slug),
    ),
    'private and recalculating collectors stay out of rankings',
  );
  const awards = achievements
    .filter((a) => a.enabled && a.subject === 'COLLECTOR' && !a.hidden)
    .slice(0, 2);
  for (const c of [winner, privateC, pending])
    for (const [i, a] of awards.entries()) {
      await db().collectorAchievement.create({
        data: {
          collectorId: c.id,
          achievementId: `${RULESET}:${a.key}`,
          awardedAt: new Date(`2030-01-0${i + 1}T12:00:00Z`),
          evidence: {},
          gateSatisfied: true,
        },
      });
    }
  await db().progressionJob.create({
    data: { subjectType: 'COLLECTOR', subjectId: pending.id },
  });
  const set = collectionSets.find((s) => s.key === 'first-specimen')!;
  await db().collectorSetProgress.create({
    data: {
      collectorId: winner.id,
      setId: `${COLLECTION_RULESET}:${set.key}`,
      currentlyComplete: true,
      completedAt: new Date('2030-01-03T12:00:00Z'),
      completionCount: 1,
      progress: {
        complete: true,
        progress: 1,
        requirements: [{ count: 1, tokens: [1] }],
      },
    },
  });
  let thread = await collectorThread();
  const own = thread.cards.filter((c) => c.slug === winner.slug);
  const recentProjection = await progressionView('COLLECTOR', winner.id, true);
  check(
    recentProjection?.status === 'ready' &&
      recentProjection.recentBadgeSummary.badges[0]?.key === awards[1].key &&
      recentProjection.recentBadgeSummary.badges[1]?.key === awards[0].key,
    'profile badge order follows earned dates rather than prestige or catalog order',
  );
  check(
    own.length === 3 && own[0].kind === 'set' && own[1].key === awards[1].key,
    'thread automatically combines sets and achievements newest first',
  );
  check(
    own.every((c) => c.path.startsWith('/share?')),
    'thread cards open the existing Sharing experience',
  );
  await db().collectorSetProgress.update({
    where: {
      collectorId_setId: {
        collectorId: winner.id,
        setId: `${COLLECTION_RULESET}:${set.key}`,
      },
    },
    data: { currentlyComplete: false },
  });
  check(
    !(await collectorThread()).cards.some(
      (c) => c.slug === winner.slug && c.kind === 'set',
    ),
    'a set that is no longer complete leaves the thread',
  );
  await db().collectorSetProgress.update({
    where: {
      collectorId_setId: {
        collectorId: winner.id,
        setId: `${COLLECTION_RULESET}:${set.key}`,
      },
    },
    data: { currentlyComplete: true },
  });
  check(
    !JSON.stringify(thread).includes(privateC.slug) &&
      !JSON.stringify(thread).includes(pending.slug),
    'thread withholds private and pending collector details',
  );
  check(
    !own[0].card.tokens.length,
    'sharing card privacy withholds set token evidence when wallets are hidden',
  );
  await db().collectorAchievement.update({
    where: {
      collectorId_achievementId: {
        collectorId: winner.id,
        achievementId: `${RULESET}:${awards[0].key}`,
      },
    },
    data: { revokedAt: new Date() },
  });
  thread = await collectorThread();
  check(
    !thread.cards.some(
      (c) => c.slug === winner.slug && c.key === awards[0].key,
    ),
    'revoked achievements leave the thread',
  );
  await db().collector.update({
    where: { id: winner.id },
    data: { showCommunityActivity: false },
  });
  check(
    !(await collectorThread()).cards.some((c) => c.slug === winner.slug),
    'activity opt-out removes all of the collector cards',
  );
  check(
    (await topCollectors()).collectors.some((c) => c.slug === winner.slug),
    'thread opt-out does not hide the public leaderboard profile',
  );
  await db().collector.update({
    where: { id: winner.id },
    data: { showCommunityActivity: true },
  });
  const p = await progressionView('COLLECTOR', winner.id, true);
  check(
    p?.status === 'ready' && p.recent[0].key === awards[1].key,
    'most recent earned badge uses award date',
  );
  const publicProfile = await (
    await fetch(base + '/collector/' + winner.slug)
  ).text();
  const level =
    publicProfile.match(/class="showcase-level"[\s\S]*?<\/div>/)?.[0] ?? '';
  check(
    level.includes(awards[1].name) && !level.includes(awards[0].name),
    'public profile highlights show the most recently earned valid badges',
  );

  const html = await (await fetch(base + '/thread')).text();
  check(
    html.includes(winner.slug) &&
      !html.includes(privateC.slug) &&
      !html.includes(pending.slug),
    'public thread HTML and RSC respect privacy and pending states',
  );
  if (!browserTests) return;
  const token = randomBytes(32).toString('hex');
  await db().authSession.create({
    data: {
      collectorId: winner.id,
      tokenHash: authHash(token),
      expiresAt: new Date(Date.now() + 3600000),
    },
  });
  await mkdir('.data/community', { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    await context.addCookies([
      { name: 'uglydex_session', value: token, url: base },
    ]);
    const page = await context.newPage();
    for (const width of [1440, 900, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const path of ['/collectors', '/thread']) {
        await page.goto(base + path, { waitUntil: 'networkidle' });
        check(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          `${path} fits ${width}px`,
        );
        if (path === '/collectors') {
          check(
            await page.locator('.collector-rank-card').evaluateAll((cards) =>
              cards.every((card) => {
                const avatar = card
                  .querySelector('.avatar-image')!
                  .getBoundingClientRect();
                const name = card
                  .querySelector('.collector-rank-name')!
                  .getBoundingClientRect();
                return (
                  avatar.right <= name.left &&
                  Math.abs(avatar.width - avatar.height) < 1
                );
              }),
            ),
            `leaderboard avatars stay circular and clear of names at ${width}px`,
          );
        }
        await page.screenshot({
          path: `.data/community/${path.slice(1)}-${width}.png`,
          fullPage: true,
        });
      }
      check(
        await page
          .locator('.brand-mark')
          .evaluate(
            (el) => getComputedStyle(el).backgroundColor === 'rgba(0, 0, 0, 0)',
          ),
        'logo button has a transparent background',
      );
      const menu = page.locator(width > 820 ? '.account-menu' : '.mobile-menu');
      await menu.locator('summary').click();
      await menu
        .getByRole('link', { name: 'Profile settings', exact: true })
        .click();
      await page.waitForURL('**/settings/profile');
      check(
        (await menu.getAttribute('open')) === null,
        'navigation click closes the header menu',
      );
      await menu.locator('summary').click();
      await page.keyboard.press('Escape');
      check(
        (await menu.getAttribute('open')) === null,
        'Escape closes the menu',
      );
    }
    await page.route(base + '/api/settings/profile', async (route) => {
      const response = await route.fetch({
        headers: {
          ...(await route.request().allHeaders()),
          origin: process.env.PUBLIC_BASE_URL!,
        },
      });
      await route.fulfill({ response });
    });
    await page
      .getByRole('checkbox', {
        name: 'Share my achievements and completed sets in the collector thread',
      })
      .uncheck();
    const response = page.waitForResponse(
      (r) =>
        r.url() === base + '/api/settings/profile' &&
        r.request().method() === 'POST',
    );
    await page
      .getByRole('button', { name: 'Save profile', exact: true })
      .click();
    check((await response).ok(), 'collector can save thread opt-out');
    await page.getByText('Profile saved.', { exact: true }).waitFor();
    await page.goto(base + '/thread');
    check(
      !(await page
        .locator(`.collector-thread a[href="/collector/${winner.slug}"]`)
        .count()),
      'saved opt-out immediately removes public thread cards',
    );
    await page.goto(base + '/settings/profile');
    check(
      !(await page
        .getByRole('checkbox', {
          name: 'Share my achievements and completed sets in the collector thread',
        })
        .isChecked()),
      'thread preference persists',
    );
    const after = await db().collectorProgress.findUniqueOrThrow({
      where: { collectorId: winner.id },
    });
    check(
      after.xp === 1000n && after.level === 4,
      'public pages and preference saves never award XP',
    );
  } finally {
    await browser.close();
  }
}
