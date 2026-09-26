import { describe, it, expect } from 'vitest';
import { zeroAddress } from 'viem';
import {
  deriveWalletPeriods,
  deriveCollectorPeriods,
  publicAttribution,
  passportFilters,
  explorerTransaction,
  retryRpc,
  mapLimited,
  holdingEventTypes,
  type TransferFact,
  type Attribution,
} from '../src/domain/provenance';
const a = '0x' + 'a'.repeat(40),
  b = '0x' + 'b'.repeat(40),
  c = '0x' + 'c'.repeat(40);
const date = (n: number) => new Date(n * 1000);
const event = (n: number, from: string, to: string): TransferFact => ({
  id: String(n),
  fromAddress: from,
  toAddress: to,
  blockNumber: BigInt(n),
  logIndex: 0,
  transactionIndex: 0,
  eventAt: date(n),
});
const evidence = (
  walletAddress: string,
  collectorId = 'alice',
  from = 0,
  to: number | null = null,
  status = 'VERIFIED',
): Attribution => ({
  id: walletAddress + collectorId,
  collectorId,
  walletAddress,
  status,
  effectiveFrom: date(from),
  effectiveTo: to === null ? null : date(to),
});
describe('canonical wallet periods', () => {
  it('derives mint and original minter', () => {
    const r = deriveWalletPeriods([event(1, zeroAddress, a)]);
    expect(r.mint?.toAddress).toBe(a);
    expect(r.periods[0].lostAt).toBeNull();
    expect(r.issues).toEqual([]);
  });
  it('closes A and opens B at the same timestamp', () => {
    const r = deriveWalletPeriods([event(1, zeroAddress, a), event(2, a, b)]);
    expect(r.periods[0].lostAt).toEqual(r.periods[1].acquiredAt);
    expect(r.currentWallet).toBe(b);
  });
  it('sorts out-of-order pages', () => {
    const r = deriveWalletPeriods([
      event(3, b, c),
      event(1, zeroAddress, a),
      event(2, a, b),
    ]);
    expect(r.periods.map((p) => p.walletAddress)).toEqual([a, b, c]);
    expect(r.issues).toEqual([]);
  });
  it('orders same-block logs', () => {
    const x = event(2, a, b),
      y = { ...event(2, b, c), id: 'next', logIndex: 1 };
    expect(
      deriveWalletPeriods([y, x, event(1, zeroAddress, a)]).currentWallet,
    ).toBe(c);
  });
  it('reports duplicate facts', () => {
    const e = event(1, zeroAddress, a);
    expect(deriveWalletPeriods([e, e]).issues[0]).toContain('DUPLICATE');
  });
  it('reports missing mint', () =>
    expect(deriveWalletPeriods([event(2, a, b)]).issues).toContain(
      'MISSING_MINT',
    ));
  it('reports ownership gaps', () =>
    expect(
      deriveWalletPeriods([event(1, zeroAddress, a), event(2, c, b)]).issues[0],
    ).toContain('CHAIN_GAP'));
  it('burn ends possession', () => {
    const r = deriveWalletPeriods([
      event(1, zeroAddress, a),
      event(2, a, zeroAddress),
    ]);
    expect(r.currentWallet).toBeNull();
    expect(r.periods).toHaveLength(1);
    expect(r.periods[0].lostAt).toEqual(date(2));
  });
  it('self-transfer does not restart the hold', () => {
    const r = deriveWalletPeriods([event(1, zeroAddress, a), event(2, a, a)]);
    expect(r.periods).toHaveLength(1);
    expect(r.periods[0].acquiredAt).toEqual(date(1));
  });
  it('reacquisition has separate periods', () =>
    expect(
      deriveWalletPeriods([
        event(1, zeroAddress, a),
        event(2, a, b),
        event(3, b, a),
      ]).periods.filter((p) => p.walletAddress === a),
    ).toHaveLength(2));
});
describe('temporal collector attribution', () => {
  it('does not label an evidence boundary as a chain acquisition or loss', () =>
    expect(
      holdingEventTypes(false, date(5), date(8), date(1), date(10)),
    ).toEqual({ acquired: 'OWNERSHIP_CONFIRMED', lost: 'ATTRIBUTION_ENDED' }));
  it('labels actual transfer boundaries as acquisition and loss', () =>
    expect(
      holdingEventTypes(false, date(1), date(10), date(1), date(10)),
    ).toEqual({ acquired: 'SQUIG_ACQUIRED', lost: 'SQUIG_LOST' }));
  it('retains separate reacquisitions even in one block timestamp', () => {
    const events = [
      event(1, zeroAddress, a),
      { ...event(2, a, c), eventAt: date(2) },
      { ...event(3, c, a), eventAt: date(2) },
    ];
    const r = deriveCollectorPeriods(deriveWalletPeriods(events).periods, [
      evidence(a),
      evidence(c, 'bob'),
    ]);
    expect(r.periods.map((p) => p.collectorId)).toEqual([
      'alice',
      'bob',
      'alice',
    ]);
  });
  const wallets = deriveWalletPeriods([
    event(1, zeroAddress, a),
    event(2, a, b),
    event(3, b, c),
    event(4, c, a),
  ]).periods;
  it('joins two confidently linked wallets continuously', () => {
    const r = deriveCollectorPeriods(wallets, [evidence(a), evidence(b)]);
    expect(r.periods).toHaveLength(2);
    expect(r.periods[0].acquiredAt).toEqual(date(1));
    expect(r.periods[0].lostAt).toEqual(date(3));
  });
  it('does not backdate a present-day signature', () =>
    expect(
      deriveCollectorPeriods(wallets, [evidence(a, 'alice', 5)]).periods[0]
        .acquiredAt,
    ).toEqual(date(5)));
  it('unconfirmed evidence grants no discovery', () =>
    expect(
      deriveCollectorPeriods(wallets, [
        evidence(a, 'alice', 0, null, 'UNCONFIRMED'),
      ]).periods,
    ).toEqual([]));
  it('admin reviewed evidence permits historical attribution', () =>
    expect(
      deriveCollectorPeriods(wallets, [
        evidence(a, 'alice', 0, null, 'REVIEWED'),
      ]).periods,
    ).toHaveLength(2));
  it('rejected evidence grants nothing', () =>
    expect(
      deriveCollectorPeriods(wallets, [
        evidence(a, 'alice', 0, null, 'REJECTED'),
      ]).periods,
    ).toEqual([]));
  it('invalidated evidence grants nothing', () =>
    expect(
      deriveCollectorPeriods(wallets, [
        evidence(a, 'alice', 0, null, 'INVALIDATED'),
      ]).periods,
    ).toEqual([]));
  it('revocation retains the proved past interval', () => {
    const r = deriveCollectorPeriods(wallets, [
      evidence(a, 'alice', 0, 2, 'REVOKED'),
    ]);
    expect(r.periods).toHaveLength(1);
    expect(r.periods[0].lostAt).toEqual(date(2));
  });
  it('conflicting collectors are withheld', () => {
    const r = deriveCollectorPeriods(wallets, [
      evidence(a),
      evidence(a, 'bob'),
    ]);
    expect(r.periods).toEqual([]);
    expect(r.conflicts).toEqual([a]);
  });
  it('pending conflicting evidence also blocks attribution', () =>
    expect(
      deriveCollectorPeriods(wallets, [
        evidence(a),
        evidence(a, 'bob', 0, null, 'UNCONFIRMED'),
      ]).periods,
    ).toEqual([]));
  it('time splits do not overlap', () => {
    const r = deriveCollectorPeriods(
      [deriveWalletPeriods([event(1, zeroAddress, a)]).periods[0]],
      [evidence(a, 'alice', 0, 3), evidence(a, 'bob', 3)],
    );
    expect(r.periods.map((p) => p.collectorId)).toEqual(['alice', 'bob']);
    expect(r.periods[0].lostAt).toEqual(r.periods[1].acquiredAt);
  });
  it('a gap in identity evidence interrupts a collector hold', () =>
    expect(
      deriveCollectorPeriods(wallets, [
        evidence(a, 'alice', 0, 1.5),
        evidence(b),
      ]).periods,
    ).toHaveLength(2));
});
describe('public passports', () => {
  const collector = {
    isPublic: true,
    showWallets: true,
    slug: 'alice',
    displayName: 'Alice',
  };
  it.each([
    { ...collector, isPublic: false },
    { ...collector, showWallets: false },
  ])('withholds private association %j', (c) =>
    expect(publicAttribution(c, true)).toBeNull(),
  );
  it('withholds unresolved identities', () =>
    expect(publicAttribution(collector, false)).toBeNull());
  it('returns only public fields', () =>
    expect(publicAttribution(collector, true)).toEqual({
      slug: 'alice',
      displayName: 'Alice',
    }));
  it('validates filter and page boundaries', () =>
    expect(
      passportFilters.parse({ page: '-1', order: 'x', event: 'sql' }),
    ).toEqual({ page: 1, order: 'newest', event: 'all' }));
  it('supports old-to-new pagination', () =>
    expect(
      passportFilters.parse({ page: '2', order: 'oldest', event: 'mint' }).page,
    ).toBe(2));
  it('centralizes mainnet explorer links', () =>
    expect(explorerTransaction(1, '0x' + 'a'.repeat(64))).toBe(
      'https://etherscan.io/tx/0x' + 'a'.repeat(64),
    ));
  it('rejects unsupported chains and invalid hashes', () => {
    expect(explorerTransaction(2, '0x' + 'a'.repeat(64))).toBeNull();
    expect(explorerTransaction(1, 'javascript:alert(1)')).toBeNull();
  });
  it('supports configured chain explorer', () =>
    expect(
      explorerTransaction(2, '0x' + 'a'.repeat(64), 'https://scan.example'),
    ).toContain('https://scan.example/tx/'));
});
describe('RPC resilience', () => {
  it('backs off and recovers', async () => {
    let calls = 0;
    const sleeps: number[] = [];
    expect(
      await retryRpc(
        async () => {
          if (++calls < 3) throw Error();
          return 42;
        },
        4,
        async (ms) => {
          sleeps.push(ms);
        },
      ),
    ).toBe(42);
    expect(sleeps).toEqual([500, 1000]);
  });
  it('bounds retries and redacts provider errors', async () => {
    await expect(
      retryRpc(
        async () => {
          throw Error('secret');
        },
        1,
        async () => {},
      ),
    ).rejects.toThrow('RPC_RETRIES_EXHAUSTED');
  });
  it('limits concurrency and preserves ordering', async () => {
    let active = 0,
      max = 0;
    const r = await mapLimited([1, 2, 3, 4], 2, async (n) => {
      active++;
      max = Math.max(max, active);
      await new Promise((r) => setTimeout(r, 1));
      active--;
      return n * 2;
    });
    expect(max).toBe(2);
    expect(r).toEqual([2, 4, 6, 8]);
  });
});
