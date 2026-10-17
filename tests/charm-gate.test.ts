import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  state: vi.fn(),
  record: vi.fn(),
  config: {
    DRIP_REALM_ID: 'realm',
    DRIP_REALM_POINT_ID: 'currency',
    DRIP_SYNC_INTERVAL_MS: 1800000,
    DRIP_SWEEP_PAUSED: false,
  },
}));
vi.mock('../src/server/db', () => ({
  db: () => ({
    dripSyncState: { findUnique: mocks.state },
    dripIdentity: { count: async () => 1 },
    charmBalance: { count: async () => 1 },
  }),
}));
vi.mock('../src/server/launch', () => ({
  launchContext: () => ({ commit: 'candidate' }),
  recordGate: mocks.record,
}));
vi.mock('../src/server/drip-sync', () => ({ dripConfig: () => mocks.config }));
import { verifyCharmGate } from '../src/server/charm-gate';
const current = () => ({
  currencyId: 'currency',
  alignmentHash: 'verified',
  alignmentCommit: 'candidate',
  alignmentAt: new Date(Date.now() - 60000),
  lastFullSweep: new Date(),
  lastSuccessAt: new Date(),
  monthRequests: 10,
  errorCode: null,
});
describe('CHARM scheduled synchronization evidence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.config.DRIP_SWEEP_PAUSED = false;
    mocks.state.mockResolvedValue(current());
  });
  it('accepts current aligned sweep and exact balance evidence', async () => {
    expect(await verifyCharmGate()).toBe(true);
  });
  it('does not let one current balance certify an expired scheduled sweep', async () => {
    mocks.state.mockResolvedValue({
      ...current(),
      alignmentAt: new Date(Date.now() - 7200000),
      lastFullSweep: new Date(Date.now() - 3600000),
    });
    expect(await verifyCharmGate()).toBe(false);
    expect(mocks.record).toHaveBeenCalledWith(
      'CHARM_DRIP',
      'PENDING',
      expect.any(String),
      expect.any(Object),
    );
  });
  it('requires a sweep after the current alignment verification', async () => {
    mocks.state.mockResolvedValue({
      ...current(),
      lastFullSweep: new Date(Date.now() - 120000),
    });
    expect(await verifyCharmGate()).toBe(false);
  });
  it('cannot certify launch while permission-recovery sweep pause is active', async () => {
    mocks.config.DRIP_SWEEP_PAUSED = true;
    expect(await verifyCharmGate()).toBe(false);
  });
});
