import { beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ client: {} as unknown }));
vi.mock('../src/server/db', () => ({ db: () => state.client }));
vi.mock('../src/server/achievement-badges', () => ({
  squigBadgeSummaries: async () => new Map(),
}));
import { collectionSummary } from '../src/server/collections';

beforeEach(() => {
  let liveHoldings = 2;
  // Simulate a sale committing immediately after the first metric read.
  // Independent reads see the new state; a repeatable-read snapshot does not.
  const reader = (holdings: () => number) => ({
    collectorWallet: {
      findMany: async () => [{ walletAddress: 'verified-wallet' }],
    },
    squig: {
      aggregate: async () => {
        const count = holdings();
        liveHoldings = 1;
        return {
          _count: {
            _all: count,
            uglyPoints: count,
            og: count,
            legendary: count,
          },
          _sum: { uglyPoints: count * 500 },
        };
      },
      count: async () => holdings(),
      groupBy: async () => [],
      findMany: async () => [],
    },
    squigTrait: { groupBy: async () => [] },
    squigDiscovery: { findMany: async () => [], count: async () => 0 },
    $queryRaw: async () =>
      Array.from({ length: holdings() }, (_, index) => ({
        squigId: String(index),
        discoveredAt: new Date('2026-01-01T00:00:00Z'),
        sourceKey: `observation:${index}`,
      })),
  });
  state.client = {
    ...reader(() => liveHoldings),
    $transaction: async (
      run: (tx: unknown) => unknown,
      options: { isolationLevel: string },
    ) => {
      const snapshot = liveHoldings;
      return run(
        reader(() =>
          options.isolationLevel === 'RepeatableRead' ? snapshot : liveHoldings,
        ),
      );
    },
  };
});

it('does not mix pre-sale ownership with post-sale discovery in one summary', async () => {
  const summary = await collectionSummary('collector');
  expect(summary).toMatchObject({ owned: 2, discovered: 2, uglyPoints: 1000 });
  expect(summary.discovered).toBeGreaterThanOrEqual(summary.owned);
});
