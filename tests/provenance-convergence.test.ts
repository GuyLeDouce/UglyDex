import { describe, it, expect, vi } from 'vitest';
import type { Prisma } from '../src/generated/prisma/client';
import { verifyProvenanceConvergence } from '../src/server/provenance-convergence';
import { deriveWalletPeriods } from '../src/domain/provenance';

function fixture() {
  const at = new Date('2026-09-28T00:00:00Z');
  const facts = [
    {
      id: 'fixture-mint',
      fromAddress: '0x' + '0'.repeat(40),
      toAddress: '0x' + '1'.repeat(40),
      blockNumber: 1n,
      logIndex: 0,
      transactionIndex: 0,
      eventAt: at,
      transactionHash: 'fixture-transaction',
    },
  ];
  const derived = deriveWalletPeriods(facts);
  const stored = {
    squigId: 'fixture-squig',
    dirty: false,
    complete: true,
    issues: [],
    mintAt: at,
    minter: facts[0].toAddress,
    mintBlock: 1n,
    mintTransaction: 'fixture-transaction',
    currentWallet: facts[0].toAddress,
    currentSince: at,
    transferCount: 0,
    uniqueWallets: 1,
    longestHoldSeconds: 0n,
    derivedThrough: 1n,
  };
  const tx = {
    squig: { count: vi.fn().mockResolvedValue(0) },
    chainCursor: { findUnique: vi.fn().mockResolvedValue({ blockNumber: 1n }) },
    chainBlock: { findUnique: vi.fn().mockResolvedValue({ timestamp: at }) },
    squigProvenance: { findMany: vi.fn().mockResolvedValue([stored]) },
    nftTransfer: { findMany: vi.fn().mockResolvedValue(facts) },
    historicalIdentityAttribution: { findMany: vi.fn().mockResolvedValue([]) },
    collectorOwnershipPeriod: { findMany: vi.fn().mockResolvedValue([]) },
    walletOwnershipPeriod: {
      findMany: vi
        .fn()
        .mockResolvedValue(
          derived.periods.map((p) => ({ ...p, squigId: stored.squigId })),
        ),
    },
    squigDiscovery: { findMany: vi.fn().mockResolvedValue([]) },
    collectorActivity: { findMany: vi.fn().mockResolvedValue([]) },
  };
  return {
    tx,
    stored,
    run: () =>
      verifyProvenanceConvergence(tx as unknown as Prisma.TransactionClient),
  };
}
describe('read-only provenance engine parity', () => {
  it('rejects an ownership activity unsupported by the immutable ledger', async () => {
    const f = fixture();
    f.tx.collectorActivity.findMany.mockResolvedValue([
      { eventKey: 'unexpected-ownership-event' },
    ]);
    expect((await f.run())[0].status).toBe('FAIL');
  });
  it('rejects a historical confirmed discovery unsupported by attribution', async () => {
    const f = fixture();
    f.tx.squigDiscovery.findMany.mockResolvedValue([
      {
        collectorId: 'unattributed',
        attributionStatus: 'CONFIRMED',
        discoveredAt: new Date('2026-09-27'),
        sourceKey: 'provenance',
      },
    ]);
    expect((await f.run())[0].status).toBe('FAIL');
  });
  it('matches the writer boundary for unrelated future source discoveries', async () => {
    const f = fixture();
    f.tx.squigDiscovery.findMany.mockResolvedValue([
      {
        collectorId: 'unattributed',
        attributionStatus: 'CONFIRMED',
        discoveredAt: new Date('2026-09-29'),
        sourceKey: 'other-source',
      },
    ]);
    expect((await f.run())[0].status).toBe('PASS');
  });
  it('matches a materialized immutable mint ledger without a write API', async () => {
    const f = fixture();
    expect((await f.run())[0].status).toBe('PASS');
  });
  it('rejects absent projections for semantic transfer inputs', async () => {
    const f = fixture();
    f.tx.squig.count.mockResolvedValue(1);
    expect((await f.run())[0].status).toBe('FAIL');
  });
  it('rejects altered wallet period semantics', async () => {
    const f = fixture();
    f.tx.walletOwnershipPeriod.findMany.mockResolvedValue([]);
    expect((await f.run())[0].status).toBe('FAIL');
  });
  it('rejects stale mint/current-owner projection fields', async () => {
    const f = fixture();
    f.stored.currentWallet = '0x' + '2'.repeat(40);
    expect((await f.run())[0].status).toBe('FAIL');
  });
  it('rejects altered projected holding duration', async () => {
    const f = fixture();
    f.stored.longestHoldSeconds = 1n;
    expect((await f.run())[0].status).toBe('FAIL');
  });
});
