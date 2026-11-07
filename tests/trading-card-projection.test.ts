import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  progression: vi.fn(),
  activity: vi.fn(),
}));
vi.mock('@/server/db', () => ({
  db: () => ({ squig: { findFirst: mocks.findFirst } }),
}));
vi.mock('@/server/progression', () => ({ progressionView: mocks.progression }));
vi.mock('@/server/activity', () => ({ ecosystemSummary: mocks.activity }));
import { shareCard } from '../src/server/sharing';
beforeEach(() => vi.clearAllMocks());
it('projects public token data without owner, progression, history or custom-art queries', async () => {
  mocks.findFirst.mockResolvedValue({
    id: 'private-internal-id',
    tokenId: 312,
    rarityTier: 'epic',
    og: true,
    legendary: false,
    uglyPoints: 795,
    mawRank: 433,
    metadataSourceHash: 'metadata-revision',
    metadataUpdatedAt: new Date('2026-11-01'),
    traits: [{ traitType: 'Eyes', value: 'Triple' }],
  });
  const card = await shareCard({
    kind: 'passport',
    entity: '312',
    format: 'trading-card',
  });
  expect(card).toMatchObject({
    tokens: [312],
    tradingCard: {
      uglyPoints: '795',
      mawRank: 433,
      traits: [{ traitType: 'Eyes', value: 'Triple' }],
    },
  });
  expect(JSON.stringify(card)).not.toContain('private-internal-id');
  expect(card?.variants).toBeUndefined();
  expect(card?.collectorLayout).toBeUndefined();
  expect(mocks.progression).not.toHaveBeenCalled();
  expect(mocks.activity).not.toHaveBeenCalled();
  expect(mocks.findFirst.mock.calls[0][0].where).toMatchObject({
    chainId: 1,
    tokenId: 312,
  });
});
it('returns unavailable for a token not yet indexed', async () => {
  mocks.findFirst.mockResolvedValue(null);
  expect(
    await shareCard({
      kind: 'passport',
      entity: '312',
      format: 'trading-card',
    }),
  ).toBeNull();
});
