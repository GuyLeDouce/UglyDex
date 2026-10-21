import { expect, it } from 'vitest';
import sharp from 'sharp';
import { shareSchema, shareQuery, type ShareCard } from '../src/domain/sharing';
import { renderShare } from '../src/server/share-render';
it('round trips a selection and rejects duplicates and more than twelve', () => {
  const achievements = Array.from(
    { length: 12 },
    (_, i) => `collector-wins-${i + 1}`,
  ).join(',');
  const spec = { kind: 'achievement', entity: 'ugly-friend', achievements };
  expect(
    shareSchema.parse(
      Object.fromEntries(
        new URLSearchParams(shareQuery({ ...spec, kind: 'achievement' })),
      ),
    ).achievements,
  ).toBe(achievements);
  expect(
    shareSchema.safeParse({ ...spec, achievements: achievements + ',extra' })
      .success,
  ).toBe(false);
  expect(
    shareSchema.safeParse({ ...spec, achievements: 'same,same' }).success,
  ).toBe(false);
});
it('renders all twelve icons at both supported card sizes', async () => {
  const card: ShareCard = {
    title: 'Collector achievements',
    eyebrow: 'UNLOCKED BY COLLECTOR',
    description: 'Earned milestones',
    stats: [],
    badges: [],
    tokens: [],
    path: '/share',
    indexable: true,
    achievementIcons: Array.from({ length: 12 }, (_, i) => ({
      key: String(i),
      name: 'Walking Encyclopedia',
      icon: '/icons/status/new-discovery.png',
    })),
  };
  for (const ratio of ['landscape', 'square'] as const) {
    const response = renderShare(card, { ratio, template: 'clean' }, {});
    const png = Buffer.from(await response.arrayBuffer());
    expect(await sharp(png).metadata()).toMatchObject({
      width: ratio === 'square' ? 1080 : 1200,
      height: ratio === 'square' ? 1080 : 630,
    });
  }
});
