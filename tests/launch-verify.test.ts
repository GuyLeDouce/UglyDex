import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({
  record: vi.fn(),
  jobs: 0,
  prior: 'DEGRADED',
}));
vi.mock('../src/server/production', () => ({ preflight: async () => [] }));
vi.mock('../src/server/deployment', () => ({
  assertDeploymentBinding: vi.fn(),
}));
vi.mock('../src/server/launch', () => ({
  recordGate: mock.record,
  launchReport: async () => ({}),
}));
vi.mock('../src/sync/provenance', () => ({ chainKey: 'test-chain' }));
vi.mock('../src/server/db', () => ({
  db: () => ({
    workerControl: { findMany: async () => [] },
    workerHeartbeat: { findMany: async () => [] },
    chainCursor: { findUnique: async () => null },
    squigProvenance: { count: async () => 0 },
    productionStage: { findUnique: async () => null },
    launchGate: { findUnique: async () => ({ status: mock.prior }) },
    collectorActivity: { count: async () => 0 },
    activityAttributionJob: { count: async () => mock.jobs },
  }),
}));
import { verifyLaunch } from '../src/server/launch-verify';

describe('attribution gate recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('DATABASE_URL', 'postgresql://test:test@localhost/test');
    mock.jobs = 0;
    mock.prior = 'DEGRADED';
  });
  afterEach(() => vi.unstubAllEnvs());

  it('replaces stale degradation after normal queue processing without claiming verification', async () => {
    await verifyLaunch();
    expect(mock.record).toHaveBeenCalledWith(
      'REATTRIBUTION',
      'PENDING',
      expect.stringContaining('0 pending attribution jobs'),
      { jobs: 0, unresolved: 0 },
    );
  });

  it('keeps a nonempty queue degraded', async () => {
    mock.jobs = 1;
    await verifyLaunch();
    expect(mock.record).toHaveBeenCalledWith(
      'REATTRIBUTION',
      'DEGRADED',
      expect.any(String),
      { jobs: 1, unresolved: 0 },
    );
  });

  it('preserves reviewed verification when the queue remains empty', async () => {
    mock.prior = 'VERIFIED';
    await verifyLaunch();
    expect(
      mock.record.mock.calls.some(([key]) => key === 'REATTRIBUTION'),
    ).toBe(false);
  });
});
