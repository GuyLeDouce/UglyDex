import { describe, expect, it } from 'vitest';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { achievements } from '../src/domain/progression';
import {
  achievementBadgeAssets,
  achievementBadgeFile,
} from '../src/server/achievement-badge-assets';
import {
  achievementBadgePresentation,
  earnedBadgeSummary,
  getAchievementBadgeUrl,
} from '../src/server/achievement-badges';
import { AchievementBadge } from '../src/components/achievement-badge';
import { AchievementStrip } from '../src/components/achievement-strip';
import { SquigCard } from '../src/components/collection';
import { renderShare } from '../src/server/share-render';
import type { VisibleAchievementBadge } from '../src/domain/achievement-badges';

const audit = JSON.parse(
  await readFile('data/achievement-badges.json', 'utf8'),
) as {
  key: string;
  file: string;
  sha256: string;
  type: string;
  achievement: string;
}[];
const earned = (key: string) =>
  achievementBadgePresentation(
    key,
    true,
    false,
    '11111111-1111-4111-8111-111111111111',
  ) as VisibleAchievementBadge;
const markup = (key: string, unlocked: boolean, blocked = false) =>
  renderToStaticMarkup(
    createElement(AchievementBadge, {
      badge: achievementBadgePresentation(key, unlocked, blocked),
      showTooltip: true,
    }),
  );

describe('approved achievement artwork integrity', () => {
  it('maps exactly 65 canonical achievements once with the correct subjects and names', async () => {
    expect(Object.keys(achievementBadgeAssets).sort()).toEqual(
      achievements.map((a) => a.key).sort(),
    );
    expect(new Set(Object.values(achievementBadgeAssets)).size).toBe(65);
    expect(audit).toHaveLength(65);
    for (const subject of ['COLLECTOR', 'SQUIG']) {
      const rows = audit.filter((a) => a.type.toUpperCase() === subject);
      expect(rows).toHaveLength(subject === 'COLLECTOR' ? 43 : 22);
      for (const row of rows) {
        expect(achievements.find((a) => a.key === row.key)).toMatchObject({
          subject,
          name: row.achievement,
        });
        expect(achievementBadgeFile(row.key)).toBe(row.file);
        expect(row.file).toContain(`/achievements/${subject.toLowerCase()}/`);
        expect(
          getAchievementBadgeUrl(
            row.key,
            true,
            '11111111-1111-4111-8111-111111111111',
          ),
        ).not.toBeNull();
      }
    }
    const files = (
      await Promise.all(
        [
          'public/achievements/collector',
          'public/achievements/squig',
          'assets/achievements/collector',
        ].map(async (dir) =>
          (await readdir(dir)).filter((f) => f.endsWith('.png')),
        ),
      )
    ).flat();
    expect(files).toHaveLength(65);
  });
  it.each(audit)(
    '$key decodes, preserves transparency and matches the approved original bytes',
    async ({ file, sha256 }) => {
      const bytes = await readFile(file);
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(sha256);
      expect(await sharp(bytes).metadata()).toMatchObject({
        format: 'png',
        width: 512,
        height: 512,
        hasAlpha: true,
        channels: 4,
      });
      const { data, info } = await sharp(bytes)
        .raw()
        .toBuffer({ resolveWithObject: true });
      expect(data.length).toBe(512 * 512 * 4);
      // All four corners remain transparent: no flattened square or clipped circular mask.
      for (const [x, y] of [
        [0, 0],
        [511, 0],
        [0, 511],
        [511, 511],
      ])
        expect(data[(y * info.width + x) * 4 + 3]).toBe(0);
      expect((await sharp(bytes).stats()).isOpaque).toBe(false);
    },
  );
});

describe('viewer-safe badge presentation', () => {
  it('uses the same image for earned, locked and pending states', () => {
    for (const [unlocked, blocked, status] of [
      [true, false, 'earned'],
      [false, false, 'locked'],
      [false, true, 'pending'],
    ] as const) {
      const html = markup('squig-mint-1', unlocked, blocked);
      expect(html).toContain(`achievement-badge--${status}`);
      expect(html).toContain('born-ugly.png');
      expect(html).toContain('tabindex="0"');
    }
  });
  it('never projects locked secret metadata or requests its image', () => {
    const badge = achievementBadgePresentation('collector-systems-7', false);
    expect(badge).toEqual({ status: 'hidden' });
    const html = markup('collector-systems-7', false);
    expect(html).not.toMatch(/<img|Furniture|systems|furniture|7 confirmed/);
    expect(html).toContain('Hidden achievement');
    expect(getAchievementBadgeUrl('collector-systems-7')).toBeNull();
    expect(getAchievementBadgeUrl('constructor')).toBeNull();
    expect(getAchievementBadgeUrl('../secret')).toBeNull();
    expect(earned('collector-systems-7').url).toContain(
      '/api/achievement-badges/',
    );
  });
  it('distinguishes the two Certified Menace achievements', () => {
    expect(earned('collector-wins-25').url).not.toBe(
      earned('squig-wins-25').url,
    );
    expect(earned('collector-wins-25').subject).toBe('COLLECTOR');
    expect(earned('squig-wins-25').subject).toBe('SQUIG');
  });
  it('orders by existing display tier then catalog order, regardless of input order, and deduplicates', () => {
    const cards = [
      'squig-wins-25',
      'squig-duels-1',
      'collector-wins-25',
      'squig-duels-100',
      'squig-duels-25',
      'squig-duels-100',
    ].map((key) => ({ badge: earned(key) }));
    const first = earnedBadgeSummary('SQUIG', cards);
    expect(first).toEqual(earnedBadgeSummary('SQUIG', cards.toReversed()));
    expect(first.badges.map((b) => b.key)).toEqual([
      'squig-duels-100',
      'squig-duels-25',
      'squig-wins-25',
      'squig-duels-1',
    ]);
  });
  it.each(['SQUIG', 'COLLECTOR'] as const)(
    '%s strip filters the other subject and displays accurate overflow',
    (subject) => {
      const badges = achievements
        .filter((a) => a.subject === subject)
        .slice(0, 5)
        .map((a) => earned(a.key));
      const wrong = earned(
        subject === 'SQUIG' ? 'collector-wins-25' : 'squig-wins-25',
      );
      const html = renderToStaticMarkup(
        createElement(AchievementStrip, {
          subject,
          summary: { status: 'ready', badges: [...badges, wrong] },
        }),
      );
      expect(html.match(/<img /g)).toHaveLength(3);
      expect(html).toContain('+2');
      expect(html).not.toContain(wrong.url.replaceAll('/', '%2F'));
    },
  );
  it('withholds stale pending badges and shows clean empty states', () => {
    for (const status of ['ready', 'pending'] as const) {
      const html = renderToStaticMarkup(
        createElement(AchievementStrip, {
          subject: 'SQUIG',
          summary: {
            status,
            badges: status === 'pending' ? [earned('squig-mint-1')] : [],
          },
        }),
      );
      expect(html).not.toContain('<img');
      expect(html).toContain(
        status === 'pending' ? 'awaiting evaluation' : 'No earned achievements',
      );
    }
  });
  it('NFT card links to its token and never shows Collector awards', () => {
    const html = renderToStaticMarkup(
      createElement(SquigCard, {
        item: {
          tokenId: 7,
          name: null,
          image: null,
          uglyPoints: null,
          mawRank: null,
          rarity: null,
          og: false,
          legendary: false,
          traits: [],
          sets: [],
          achievements: {
            status: 'ready',
            badges: [earned('squig-mint-1'), earned('collector-discoveries-1')],
          },
        },
      }),
    );
    expect(html).toContain('href="/squig/7"');
    expect(html).toContain('born-ugly.png');
    expect(html).not.toContain('first-ugly.png');
  });
  it.each(['landscape', 'square'] as const)(
    'embeds transparent badge art in the existing %s PNG export',
    async (ratio) => {
      const card = {
        title: 'Badge export',
        eyebrow: 'EARNED',
        description: 'Verified history',
        stats: [],
        badges: [],
        tokens: [],
        path: '/squig/7',
        indexable: true,
      };
      const withBadge = Buffer.from(
        await renderShare(
          { ...card, achievementBadges: [earned('squig-mint-1')] },
          { ratio, template: 'clean' },
          {},
        ).arrayBuffer(),
      );
      const withoutBadge = Buffer.from(
        await renderShare(card, { ratio, template: 'clean' }, {}).arrayBuffer(),
      );
      expect(await sharp(withBadge).metadata()).toMatchObject({
        width: ratio === 'square' ? 1080 : 1200,
        height: ratio === 'square' ? 1080 : 630,
      });
      expect(withBadge.equals(withoutBadge)).toBe(false);
    },
    20000,
  );
});
