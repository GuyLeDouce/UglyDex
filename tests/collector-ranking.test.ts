import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  names: vi.fn(),
  evidence: vi.fn(),
}));
vi.mock('../src/server/db', () => ({
  db: () => ({
    $transaction: async (run: (tx: unknown) => unknown) =>
      run({ $queryRaw: mocks.query, collector: { findMany: mocks.names } }),
  }),
}));
vi.mock('../src/server/sharing', () => ({ shareCard: vi.fn() }));
vi.mock('../src/server/wallet-field-guide', () => ({
  publicWalletEvidence: mocks.evidence,
}));
import { topCollectors } from '../src/server/community';
beforeEach(() => {
  vi.resetAllMocks();
  mocks.query.mockResolvedValue(
    Array.from({ length: 25 }, (_, i) => ({
      id: String(i),
      slug: 'collector-' + String(i).padStart(2, '0'),
      avatar: null,
      overall: i,
      discovered: i,
      unclaimed: false,
      pending: i < 7,
    })),
  );
  mocks.evidence.mockResolvedValue([]);
  mocks.names.mockResolvedValue([]);
});
it.each([NaN, Infinity, -2, 1.5])(
  'normalizes invalid page %s',
  async (page) => {
    expect(await topCollectors(page)).toMatchObject({
      page: 1,
      pages: 2,
      total: 25,
      pending: 7,
    });
  },
);
it('ranks globally before pagination and keeps updating profiles visible', async () => {
  const first = await topCollectors();
  const last = await topCollectors(999);
  expect(first.collectors[0].slug).toBe('collector-24');
  expect(last).toMatchObject({ page: 2, pages: 2, total: 25, pending: 7 });
  expect(last.collectors[0]).toMatchObject({
    slug: 'collector-00',
    pending: true,
    rank: 25,
  });
});
it('includes unclaimed wallets without snapshots and computes observation scores', async () => {
  mocks.query.mockResolvedValue([
    {
      id: 'wallet',
      walletTracked: true,
      slug: 'holder',
      avatar: null,
      overall: null,
      discovered: null,
      unclaimed: true,
      pending: true,
    },
  ]);
  mocks.evidence.mockResolvedValue([
    { collectorId: 'wallet', currentIds: [1, 2], historyIds: [1, 2, 3] },
  ]);
  const result = await topCollectors();
  expect(result).toMatchObject({ total: 1, unclaimed: 1, pending: 0 });
  expect(result.collectors[0]).toMatchObject({
    owned: 2,
    discovered: 3,
    unclaimed: true,
    pending: false,
    rank: 1,
  });
  expect(result.collectors[0].overall).toBeGreaterThan(0);
  expect(result.collectors[0]).not.toHaveProperty('id');
});
