import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  binding: vi.fn(),
  stage: vi.fn(),
  cursor: vi.fn(),
  sources: vi.fn(),
  report: vi.fn(),
  admission: vi.fn(),
  anchor: vi.fn(),
  auditCreate: vi.fn(),
  control: vi.fn(),
  lock: vi.fn(),
}));
vi.mock('../src/server/deployment', () => ({
  assertDeploymentBinding: mocks.binding,
  assertOperation: vi.fn(),
}));
vi.mock('../src/server/db', () => ({
  db: () => ({
    productionStage: { findUnique: mocks.stage },
    chainCursor: { findUnique: mocks.cursor },
    integrationSource: { findMany: mocks.sources },
    operationalAudit: { findFirst: mocks.admission },
    chainBlock: { findUnique: mocks.anchor },
    $transaction: async (run: (tx: unknown) => unknown) =>
      run({
        $queryRaw: mocks.lock,
        workerControl: { upsert: mocks.control },
        operationalAudit: { create: mocks.auditCreate },
      }),
  }),
}));
vi.mock('../src/server/env', () => ({
  readEnv: () => ({
    ETH_RPC_URL: 'https://rpc.example.test',
    SQUIGS_START_BLOCK: 25342921,
  }),
}));
vi.mock('../src/server/launch', () => ({
  launchReport: mocks.report,
  launchContext: () => ({
    environment: 'staging',
    commit: 'fixture-revision',
    databaseFingerprint: 'fixture-database',
  }),
}));
vi.mock('../src/sync/provenance', () => ({ chainKey: 'fixture-chain' }));
vi.mock('../src/integrations/bridge-config', () => ({
  integrationConfigured: (integration: string) => integration === 'gauntlet',
}));
import {
  workerReadiness,
  setWorkerControl,
} from '../src/server/worker-runtime';

const required = [
  'MINT_COVERAGE',
  'OWNERSHIP_CONTINUITY',
  'OWNER_OF',
  'START_BLOCK',
  'ARCHIVE_RPC',
];
// Load the real feed registry outside the per-assertion timeout. On the copied
// USB tree its first transform is slow; worker behavior still has the normal limit.
beforeAll(async () => {
  await import('../src/integrations/registry');
  await import('../src/sync/normalize');
}, 60000);
beforeEach(() => {
  vi.resetAllMocks();
  mocks.stage.mockResolvedValue(null);
  mocks.admission.mockResolvedValue(null);
  mocks.anchor.mockResolvedValue({ hash: 'fixture-anchor' });
  mocks.lock.mockResolvedValue([{ acquired: true }]);
  mocks.cursor.mockResolvedValue({
    blockNumber: 26068941n,
    finalizedBlock: 26068941n,
    lastError: null,
    blockHash: 'fixture-anchor',
  });
  mocks.report.mockResolvedValue({
    gates: required.map((key) => ({ key, status: 'VERIFIED' })),
  });
  mocks.sources.mockResolvedValue([
    {
      id: 'runs',
      state: 'PARTIAL',
      schemaValid: true,
      backfillFinishedAt: new Date(),
      warning: null,
    },
    {
      id: 'onlineRewards',
      state: 'UNAVAILABLE',
      schemaValid: false,
      backfillFinishedAt: null,
      warning: 'FEED_UNAVAILABLE',
    },
  ]);
});
describe('LIVE worker readiness against completed independent launch evidence', () => {
  it('audits actual verified bootstrap boundary through normal worker control', async () => {
    await setWorkerControl(
      { service: 'blockchain', mode: 'LIVE' },
      'test-operator',
    );
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: {
        actor: 'test-operator',
        action: 'BLOCKCHAIN_LIVE_ADMISSION',
        subject: 'fixture-chain',
        detail: {
          environment: 'staging',
          commit: 'fixture-revision',
          databaseFingerprint: 'fixture-database',
          chainKey: 'fixture-chain',
          startBlock: '25342921',
          blockNumber: '26068941',
          blockHash: 'fixture-anchor',
        },
      },
    });
  });
  it('cannot fabricate admission for unfinished history', async () => {
    mocks.cursor.mockResolvedValue({
      blockNumber: 5n,
      finalizedBlock: 6n,
      lastError: null,
    });
    await setWorkerControl(
      { service: 'blockchain', mode: 'LIVE' },
      'test-operator',
    );
    expect(mocks.auditCreate).toHaveBeenCalledTimes(1);
    expect(mocks.auditCreate.mock.calls[0][0].data.action).toBe('WORKER_MODE');
  });
  it('continues and resumes admitted LIVE catch-up across bounded batches', async () => {
    mocks.cursor.mockResolvedValue({
      blockNumber: 26069941n,
      finalizedBlock: 26071506n,
      lastError: null,
    });
    mocks.admission.mockResolvedValue({
      detail: {
        environment: 'staging',
        commit: 'fixture-revision',
        databaseFingerprint: 'fixture-database',
        chainKey: 'fixture-chain',
        startBlock: '25342921',
        blockNumber: '26068941',
        blockHash: 'fixture-anchor',
      },
    });
    expect(await workerReadiness('blockchain', 'LIVE')).toBe('READY');
    // A restarted runtime reads the same durable admission, without in-memory state.
    expect(await workerReadiness('blockchain', 'LIVE')).toBe('READY');
  });
  it.each([
    { commit: 'older-revision' },
    { databaseFingerprint: 'different-database' },
    { environment: 'production' },
    { startBlock: '100' },
    { blockNumber: '26079941' },
    { blockHash: 'reorged-anchor' },
  ])('rejects invalid durable catch-up admission %j', async (patch) => {
    mocks.cursor.mockResolvedValue({
      blockNumber: 26069941n,
      finalizedBlock: 26071506n,
      lastError: null,
    });
    mocks.admission.mockResolvedValue({
      detail: {
        environment: 'staging',
        commit: 'fixture-revision',
        databaseFingerprint: 'fixture-database',
        chainKey: 'fixture-chain',
        startBlock: '25342921',
        blockNumber: '26068941',
        blockHash: 'fixture-anchor',
        ...patch,
      },
    });
    expect(await workerReadiness('blockchain', 'LIVE')).toBe(
      'WAITING_BACKFILL',
    );
  });
  it('permits verified caught-up chain without fabricating ProductionStage', async () => {
    expect(await workerReadiness('blockchain', 'LIVE')).toBe('READY');
    expect(mocks.binding).toHaveBeenCalled();
  });
  it.each(required)(
    'requires effective current-revision %s evidence',
    async (key) => {
      mocks.report.mockResolvedValue({
        gates: required.map((k) => ({
          key: k,
          status: k === key ? 'PENDING' : 'VERIFIED',
        })),
      });
      expect(await workerReadiness('blockchain', 'LIVE')).toBe(
        'WAITING_BACKFILL',
      );
    },
  );
  it.each([
    null,
    { blockNumber: 5n, finalizedBlock: 6n, lastError: null },
    { blockNumber: 6n, finalizedBlock: null, lastError: null },
    { blockNumber: 6n, finalizedBlock: 6n, lastError: 'RPC_FAILED' },
  ])('rejects incomplete or failed cursor %#', async (cursor) => {
    mocks.cursor.mockResolvedValue(cursor);
    expect(await workerReadiness('blockchain', 'LIVE')).toBe(
      'WAITING_BACKFILL',
    );
  });
  it('retains normal completed transfer stage path', async () => {
    mocks.stage.mockResolvedValue({ completedAt: new Date() });
    expect(await workerReadiness('blockchain', 'LIVE')).toBe('READY');
  });
  it('permits explicitly unavailable optional source with available history complete', async () => {
    expect(await workerReadiness('ecosystem', 'LIVE')).toBe('READY');
  });
  it.each([
    { schemaValid: false },
    { state: 'ERROR', warning: 'IMPORT_FAILED' },
    { state: 'UNAVAILABLE', warning: 'PERMISSIONS_UNAVAILABLE' },
  ])('blocks broken available source %j', async (patch) => {
    const sources = await mocks.sources();
    Object.assign(sources[0], patch);
    expect(await workerReadiness('ecosystem', 'LIVE')).toBe(
      'WAITING_SOURCE_VALIDATION',
    );
  });
  it('blocks available history with no completed backfill', async () => {
    const sources = await mocks.sources();
    sources[0].backfillFinishedAt = null;
    expect(await workerReadiness('ecosystem', 'LIVE')).toBe('WAITING_BACKFILL');
  });
  it('blocks unexpected failure of an optional source', async () => {
    const sources = await mocks.sources();
    sources[1].state = 'ERROR';
    sources[1].warning = 'IMPORT_FAILED';
    expect(await workerReadiness('ecosystem', 'LIVE')).toBe(
      'WAITING_SOURCE_VALIDATION',
    );
  });
});
