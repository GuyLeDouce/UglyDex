import { expect, it, vi } from 'vitest';
vi.mock('../src/server/public-collector-name', () => ({
  publicNameSelect: {},
  publicCollectorName: () => 'Fixture',
}));
vi.mock('../src/server/db', () => ({
  db: () => ({
    collector: {
      findUnique: async () => ({
        id: 'collector',
        slug: 'fixture',
        isPublic: true,
        collectionVisibility: 'PUBLIC',
      }),
    },
    squig: { count: async () => 0, findMany: async () => [] },
  }),
}));
vi.mock('../src/server/collections', () => ({
  currentCollectionScope: async () => ({}),
  catalogScope: {},
}));
vi.mock('../src/server/galleries', () => ({
  eligibleGalleryTokens: async () => [],
}));
vi.mock('../src/server/favorites', () => ({
  favoriteTokenIds: async () => [],
}));
vi.mock('../src/server/dex', () => ({ dexView: async () => null }));
vi.mock('../src/server/cosmetics', () => ({ appearance: async () => ({}) }));
vi.mock('../src/server/progression', () => ({
  progressionView: async () => {
    const badges = [
      { key: 'collector-duels-10', name: 'Battle Regular', status: 'earned' },
      { key: 'collector-wins-25', name: 'Certified Menace', status: 'earned' },
    ];
    return {
      status: 'ready',
      level: 1,
      title: null,
      badgeSummary: { badges },
      cards: badges.map((badge) => ({ key: badge.key, unlocked: true, badge })),
    };
  },
}));
import { shareCard } from '../src/server/sharing';
it('uses selected collector artwork for captions instead of the profile summary', async () => {
  const card = await shareCard({
    kind: 'collector',
    entity: 'fixture',
    achievements: 'collector-wins-25',
  });
  expect(card?.achievementBadges?.map((b) => b.key)).toEqual([
    'collector-wins-25',
  ]);
  expect(card?.badges).toEqual(['Certified Menace']);
});
it('honors explicitly empty badge selections in captions', async () => {
  const card = await shareCard({
    kind: 'collector',
    entity: 'fixture',
    achievements: '',
  });
  expect(card?.achievementBadges).toEqual([]);
  expect(card?.badges).toEqual([]);
});
