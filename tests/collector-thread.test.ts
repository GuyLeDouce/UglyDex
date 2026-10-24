import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  wallets: vi.fn(),
  visible: vi.fn(),
  names: vi.fn(),
  share: vi.fn(),
}));
vi.mock('../src/server/db', () => ({
  db: () => ({
    $queryRaw: mocks.query,
    collectorWallet: { findMany: mocks.wallets },
    collector: { findFirst: mocks.visible, findMany: mocks.names },
  }),
}));
vi.mock('../src/server/sharing', () => ({ shareCard: mocks.share }));
import { collectorThread, COMMUNITY_PAGE_SIZE } from '../src/server/community';
import { threadIcon } from '../src/domain/thread-icons';
import { RULESET } from '../src/domain/progression';
beforeEach(() => {
  vi.resetAllMocks();
  mocks.names.mockResolvedValue([]);
});
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

it('includes a consenting recipient and requests all privacy gates for wallet matching', async () => {
  mocks.query.mockResolvedValue([
    {
      kind: 'transfer',
      key: 'tx',
      tokenId: 1,
      at: new Date(),
      chainId: 1,
      toAddress: '0xabc',
    },
  ]);
  mocks.wallets.mockResolvedValue([
    {
      chainId: 1,
      walletAddress: '0xabc',
      collector: {
        slug: 'owner',
        displayName: 'New Owner',
        showUsername: true,
        showWallets: true,
        claimedAt: new Date(),
        wallets: [],
        discoveredWallets: [],
      },
    },
  ]);
  expect((await collectorThread()).cards[0]).toMatchObject({
    recipient: { name: 'New Owner', path: '/collector/owner' },
  });
  expect(mocks.wallets).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({
        status: 'ACTIVE',
        revokedAt: null,
        collector: {
          isPublic: true,
          showWallets: true,
          showCommunityActivity: true,
          mergedIntoCollectorId: null,
        },
      }),
    }),
  );
  mocks.wallets.mockResolvedValue([]);
  expect((await collectorThread()).cards[0]).toMatchObject({ recipient: null });
});

it('automatically creates shareable milestone entries with the original milestone key', async () => {
  mocks.query.mockResolvedValue([
    {
      kind: 'milestone',
      key: 'level:10',
      slug: 'ugly-friend',
      displayName: 'Friend',
      avatar: null,
      at: new Date('2026-01-01'),
    },
  ]);
  mocks.visible.mockResolvedValue({ id: 'public' });
  mocks.share.mockResolvedValue({
    title: 'Level 10',
    path: '/share?kind=milestone&entity=ugly-friend&key=level%3A10',
  });
  const result = await collectorThread();
  expect(mocks.share).toHaveBeenCalledWith({
    kind: 'milestone',
    entity: 'ugly-friend',
    key: 'level:10',
  });
  expect(result.cards[0]).toMatchObject({
    kind: 'milestone',
    title: 'Level 10',
    key: 'level:10',
  });
});
