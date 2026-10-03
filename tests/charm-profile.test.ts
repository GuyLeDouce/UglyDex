import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ collector: vi.fn(), balance: vi.fn() }));
vi.mock('../src/server/db', () => ({
  db: () => ({
    collector: { findFirst: mocks.collector },
    squig: { findMany: async () => [] },
  }),
}));
vi.mock('../src/server/auth', () => ({ currentSession: vi.fn() }));
vi.mock('../src/server/collectibles', () => ({ displayCustom: vi.fn() }));
vi.mock('../src/server/drip-sync', () => ({ charmBalance: mocks.balance }));
vi.mock('../src/server/collections', () => ({
  collectionSummary: async () => ({}),
  cardDTO: vi.fn(),
  cardSelect: {},
  ownedScope: () => ({}),
  catalogScope: {},
  activeAddresses: vi.fn(),
}));
import { collectorProfile } from '../src/server/profiles';
beforeEach(() => {
  vi.clearAllMocks();
  mocks.collector.mockResolvedValue({
    id: 'fixture',
    slug: 'fixture',
    isPublic: true,
    showCharmBalance: false,
    identities: [],
    wallets: [],
    featuredTokenIds: [],
    collectionVisibility: 'HIDDEN',
    showWallets: false,
    showDiscord: false,
  });
  mocks.balance.mockResolvedValue({
    balance: '123.45',
    status: 'CURRENT',
    stale: false,
    updatedAt: '2026-10-01T00:00:00.000Z',
    ageMinutes: 0,
  });
});
describe('public CHARM profile boundary', () => {
  it('omits private balances without reading them', async () => {
    expect(await collectorProfile('fixture')).not.toHaveProperty('charm');
    expect(mocks.balance).not.toHaveBeenCalled();
  });
  it.each(['CONFLICT', 'UNRESOLVED'])(
    'omits an opted-in %s balance from the public DTO',
    async (status) => {
      const collector = await mocks.collector();
      collector.showCharmBalance = true;
      mocks.balance.mockResolvedValue({
        balance: '123.45',
        status,
        stale: true,
      });
      expect(await collectorProfile('fixture')).not.toHaveProperty('charm');
    },
  );
  it('exposes only a safe opted-in balance', async () => {
    const collector = await mocks.collector();
    collector.showCharmBalance = true;
    expect(await collectorProfile('fixture')).toHaveProperty(
      'charm.balance',
      '123.45',
    );
  });
});
