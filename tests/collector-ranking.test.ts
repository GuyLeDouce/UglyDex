import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ query: vi.fn(), names: vi.fn() }));
vi.mock('../src/server/db', () => ({
  db: () => ({
    $transaction: async (run: (tx: unknown) => unknown) =>
      run({
        $queryRaw: mocks.query,
        collector: { findMany: mocks.names },
      }),
  }),
}));
vi.mock('../src/server/sharing', () => ({ shareCard: vi.fn() }));
import { topCollectors } from '../src/server/community';
beforeEach(() => {
  vi.resetAllMocks();
  mocks.query
    .mockResolvedValueOnce([{ count: 25n }])
    .mockResolvedValueOnce([{ pending: 7n }])
    .mockResolvedValueOnce([{ unclaimed: 40n }])
    .mockResolvedValueOnce([]);
  mocks.names.mockResolvedValue([]);
});
it.each([NaN, Infinity, -2, 1.5])(
  'normalizes invalid page %s',
  async (page) => {
    const result = await topCollectors(page);
    expect(result).toMatchObject({
      page: 1,
      pages: 2,
      total: 25,
      pending: 7,
      unclaimed: 40,
    });
  },
);
it('clamps the last page and keeps pending profiles separate from ranked totals', async () => {
  const result = await topCollectors(999);
  expect(result).toMatchObject({
    page: 2,
    pages: 2,
    total: 25,
    pending: 7,
    unclaimed: 40,
  });
});
