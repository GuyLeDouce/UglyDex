import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  collector: vi.fn(),
  dex: vi.fn(),
  progress: vi.fn(),
  avatar: vi.fn(),
}));
vi.mock('../src/server/db', () => ({
  db: () => ({ collector: { findUnique: mocks.collector } }),
}));
vi.mock('../src/server/public-collector-name', () => ({
  publicNameSelect: {},
  publicCollectorName: () => 'Collector Name',
}));
vi.mock('../src/server/dex', () => ({ dexView: mocks.dex }));
vi.mock('../src/server/progression', () => ({
  progressionView: mocks.progress,
}));
vi.mock('../src/server/collector-avatar', () => ({
  collectorAvatar: mocks.avatar,
}));
import { shareCard } from '../src/server/sharing';
const spec = { kind: 'collector', entity: 'fixture', format: 'collector-card' };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.collector.mockResolvedValue({
    id: 'owner',
    slug: 'fixture',
    isPublic: true,
    avatar: null,
  });
  mocks.dex.mockResolvedValue({
    status: 'ready',
    score: { overall: 54 },
    discovered: 309,
    traits: 298,
    historicalSets: 31,
  });
  mocks.progress.mockResolvedValue({ status: 'ready', level: 21, count: 36 });
  mocks.avatar.mockResolvedValue({
    tokenId: 1497,
    url: 'https://squigs.io/images/images/1497.png',
  });
});
it('uses authoritative totals, resolved avatar and public projections', async () => {
  const card = await shareCard(spec);
  expect(card?.collectorCard).toEqual({
    avatar: 'https://squigs.io/images/images/1497.png',
    avatarTokenId: 1497,
    completion: 54,
    discovered: 309,
    traits: 298,
    historicalSets: 31,
    achievements: 36,
    level: 21,
  });
  expect(mocks.dex).toHaveBeenCalledWith('owner', true);
  expect(mocks.progress).toHaveBeenCalledWith('COLLECTOR', 'owner', true);
  expect(card?.tradingCard).toBeUndefined();
});
it('blocks private profiles except explicit owner preview', async () => {
  mocks.collector.mockResolvedValue({
    id: 'owner',
    slug: 'fixture',
    isPublic: false,
    avatar: null,
  });
  expect(await shareCard(spec)).toBeNull();
  expect(await shareCard(spec, 'different-owner')).toBeNull();
  expect((await shareCard(spec, 'owner'))?.indexable).toBe(false);
  expect(mocks.dex).toHaveBeenCalledWith('owner', false);
});
it('keeps pending statistics unknown, including legitimate zero totals', async () => {
  mocks.dex.mockResolvedValue(null);
  mocks.progress.mockResolvedValue(null);
  mocks.avatar.mockResolvedValue(null);
  expect((await shareCard(spec))?.collectorCard).toEqual({
    avatar: null,
    avatarTokenId: null,
    completion: null,
    discovered: null,
    traits: null,
    historicalSets: null,
    achievements: null,
    level: null,
  });
  mocks.dex.mockResolvedValue({
    status: 'ready',
    score: { overall: 0 },
    discovered: 0,
    traits: 0,
    historicalSets: 0,
  });
  expect((await shareCard(spec))?.collectorCard?.completion).toBe(0);
});
