import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  visible: vi.fn(),
  share: vi.fn(),
}));
vi.mock('../src/server/db', () => ({
  db: () => ({
    $queryRaw: mocks.query,
    collector: { findFirst: mocks.visible },
  }),
}));
vi.mock('../src/server/sharing', () => ({ shareCard: mocks.share }));
import { collectorThread, COMMUNITY_PAGE_SIZE } from '../src/server/community';
import { threadIcon } from '../src/domain/thread-icons';
import { RULESET } from '../src/domain/progression';
beforeEach(() => vi.resetAllMocks());
it('renders indexed transfers without resolving or exposing collector identities', async () => {
  mocks.query.mockResolvedValue(
    Array.from({ length: COMMUNITY_PAGE_SIZE + 1 }, (_, i) => ({
      kind: 'transfer',
      imageUrl: '/fixture-squig.png',
      key: `tx:${i}`,
      tokenId: i + 1,
      at: new Date('2026-01-01'),
      slug: null,
    })),
  );
  const result = await collectorThread();
  expect(result.hasMore).toBe(true);
  expect(result.cards).toHaveLength(COMMUNITY_PAGE_SIZE);
  expect(result.cards[0]).toMatchObject({
    name: 'Squig #1',
    path: '/squig/1#ownership',
    slug: '',
    avatar: '/fixture-squig.png',
  });
  expect(mocks.share).not.toHaveBeenCalled();
  expect(mocks.visible).not.toHaveBeenCalled();
});
it('rechecks collector visibility before including a milestone', async () => {
  mocks.query.mockResolvedValue([
    {
      kind: 'achievement',
      key: `${RULESET}:collector-wins-1`,
      at: new Date(),
      slug: 'private',
    },
  ]);
  mocks.share.mockResolvedValue({ title: 'Win', path: '/share' });
  mocks.visible.mockResolvedValue(null);
  expect((await collectorThread()).cards).toEqual([]);
});
it('uses the supplied set and relevant activity artwork', () => {
  expect(threadIcon('set', 'purple-people')).toBe(
    '/icons/sets/purple-people.png',
  );
  expect(threadIcon('achievement', 'collector-wins-1')).toBe(
    '/icons/status/recorded-victory.png',
  );
  expect(threadIcon('transfer', 'tx')).toBe('/icons/status/provenance.png');
});
