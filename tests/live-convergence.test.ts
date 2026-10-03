import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  proof: vi.fn(),
  fingerprints: vi.fn(),
  derived: vi.fn(),
  provenance: vi.fn(),
  record: vi.fn(),
  save: vi.fn(),
  query: vi.fn(),
  execute: vi.fn(),
  attribution: vi.fn(),
  progression: vi.fn(),
  collections: vi.fn(),
  dirty: vi.fn(),
  controls: vi.fn(),
  beats: vi.fn(),
  sources: vi.fn(),
  rejections: vi.fn(),
  locks: vi.fn(),
}));
vi.mock('pg', () => ({
  Pool: class {
    async connect() {
      return { query: mocks.query, release: vi.fn() };
    }
    async end() {}
  },
}));
vi.mock('../src/server/db', () => ({
  db: () => ({
    $transaction: async (run: (tx: unknown) => unknown) =>
      run({
        $executeRawUnsafe: mocks.execute,
        $queryRaw: mocks.locks,
        replayProof: { findFirst: mocks.proof },
        activityAttributionJob: { count: mocks.attribution },
        progressionJob: { count: mocks.progression },
        collectionJob: { count: mocks.collections },
        squigProvenance: { count: mocks.dirty },
        workerControl: { findMany: mocks.controls },
        workerHeartbeat: { findMany: mocks.beats },
        integrationSource: { findMany: mocks.sources },
        importRejection: { count: mocks.rejections },
      }),
    liveDerivationProof: { create: mocks.save },
  }),
}));
vi.mock('../src/server/launch', () => ({
  launchContext: () => ({
    environment: 'staging',
    commit: 'a'.repeat(40),
    databaseFingerprint: 'fixture-db',
  }),
  recordGate: mocks.record,
}));
vi.mock('../src/server/replay-proof', () => ({
  semanticFingerprints: mocks.fingerprints,
  replayConfiguration: () => ({ rules: 'unchanged' }),
  fingerprintDiff: (a: unknown, b: unknown) =>
    JSON.stringify(a) === JSON.stringify(b) ? [] : ['different'],
}));
vi.mock('../src/server/derived-verification', () => ({
  verifyDerived: mocks.derived,
}));
vi.mock('../src/server/provenance-convergence', () => ({
  verifyProvenanceConvergence: mocks.provenance,
}));
import { hash } from '../src/domain/events';
import { verifyCurrentReplay } from '../src/server/live-convergence';
const inputs = { CollectorActivity: { count: 1, sha256: 'input' } },
  outputs = { CollectorProgress: { count: 1, sha256: 'output' } };
const frozen = () => ({
  id: 'fixture-proof',
  environment: 'staging',
  commit: 'a'.repeat(40),
  databaseFingerprint: 'fixture-db',
  configurationHash: hash({ rules: 'unchanged' }),
  status: 'VERIFIED',
  finishedAt: new Date(),
  inputHash: hash(inputs),
  replayA: outputs,
  replayB: outputs,
  errorCode: null,
  differences: [],
});
beforeEach(() => {
  vi.clearAllMocks();
  mocks.proof.mockResolvedValue(frozen());
  mocks.fingerprints.mockImplementation(async (_client, mode) =>
    mode === 'input' ? inputs : outputs,
  );
  mocks.query.mockResolvedValue({
    rows: [{ snapshot: '00000001-00000001-1', at: new Date() }],
  });
  for (const key of [
    'attribution',
    'progression',
    'collections',
    'dirty',
    'rejections',
  ] as const)
    mocks[key].mockResolvedValue(0);
  mocks.controls.mockResolvedValue(
    ['blockchain', 'ecosystem', 'progression', 'collections'].map(
      (service) => ({ service, mode: 'DISABLED' }),
    ),
  );
  mocks.beats.mockResolvedValue([]);
  mocks.sources.mockResolvedValue([]);
  mocks.derived.mockResolvedValue([{ name: 'derived', status: 'PASS' }]);
  mocks.provenance.mockResolvedValue([{ name: 'provenance', status: 'PASS' }]);
  mocks.save.mockResolvedValue({ id: 'live-proof' });
  mocks.locks.mockResolvedValue([{ acquired: true }]);
});
function advance() {
  mocks.fingerprints.mockImplementation(async (_client, mode) =>
    mode === 'input'
      ? { ...inputs, CollectorActivity: { count: 2, sha256: 'advanced' } }
      : outputs,
  );
}
describe('coherent current-live replay verification', () => {
  it('retains the exact-input frozen shortcut', async () => {
    expect(await verifyCurrentReplay()).toBe(true);
    expect(mocks.derived).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it('accepts the reviewed Phase 11 frozen revision when configuration still matches', async () => {
    mocks.proof.mockResolvedValue({ ...frozen(), commit: 'cd15cd3' });
    expect(await verifyCurrentReplay()).toBe(true);
    expect(mocks.derived).not.toHaveBeenCalled();
  });
  it('requires review for an unregistered frozen derivation revision', async () => {
    mocks.proof.mockResolvedValue({ ...frozen(), commit: 'b'.repeat(40) });
    expect(await verifyCurrentReplay()).toBe(false);
    expect(mocks.derived).not.toHaveBeenCalled();
  });
  it('verifies advanced inputs with independent read-only recomputation and saves the captured boundary', async () => {
    mocks.proof.mockResolvedValue({ ...frozen(), commit: 'cd15cd3' });
    advance();
    expect(await verifyCurrentReplay()).toBe(true);
    expect(mocks.execute).toHaveBeenCalledWith('SET TRANSACTION READ ONLY');
    expect(mocks.execute).toHaveBeenCalledWith(
      "SET TRANSACTION SNAPSHOT '00000001-00000001-1'",
    );
    expect(mocks.derived).toHaveBeenCalled();
    expect(mocks.provenance).toHaveBeenCalled();
    expect(mocks.save).toHaveBeenCalledWith({
      data: expect.objectContaining({
        environment: 'staging',
        databaseFingerprint: 'fixture-db',
        frozenProofId: 'fixture-proof',
        inputHash: hash({
          ...inputs,
          CollectorActivity: { count: 2, sha256: 'advanced' },
        }),
        derived: outputs,
        status: 'VERIFIED',
      }),
    });
  });
  it.each(['derived', 'provenance'] as const)(
    'fails a %s semantic discrepancy',
    async (key) => {
      advance();
      mocks[key].mockResolvedValue([{ name: key, status: 'FAIL' }]);
      expect(await verifyCurrentReplay()).toBe(false);
      expect(mocks.record).toHaveBeenCalledWith(
        'DERIVED_REPLAY_STABLE',
        'FAILED',
        expect.any(String),
        expect.any(Object),
      );
    },
  );
  it.each(['attribution', 'dirty'] as const)(
    'does not certify a %s backlog',
    async (key) => {
      advance();
      mocks[key].mockResolvedValue(1);
      expect(await verifyCurrentReplay()).toBe(false);
      expect(mocks.derived).not.toHaveBeenCalled();
    },
  );
  it.each(['progression', 'collections'] as const)(
    'does not certify queued or failed %s jobs',
    async (key) => {
      advance();
      mocks[key].mockImplementation(async (args) => (args ? 0 : 1));
      expect(await verifyCurrentReplay()).toBe(false);
      expect(mocks.record).toHaveBeenLastCalledWith(
        'DERIVED_REPLAY_STABLE',
        'PENDING',
        expect.any(String),
        expect.any(Object),
      );
      mocks[key].mockResolvedValue(1);
      await verifyCurrentReplay();
      expect(mocks.record).toHaveBeenLastCalledWith(
        'DERIVED_REPLAY_STABLE',
        'FAILED',
        expect.any(String),
        expect.any(Object),
      );
    },
  );
  it.each([
    { commit: 'b'.repeat(40) },
    { environment: 'production' },
    { databaseFingerprint: 'other-db' },
    { configurationHash: 'changed' },
  ])('rejects an incompatible frozen boundary %j', async (change) => {
    advance();
    mocks.proof.mockResolvedValue({ ...frozen(), ...change });
    expect(await verifyCurrentReplay()).toBe(false);
    expect(mocks.derived).not.toHaveBeenCalled();
  });
  it('cannot certify advanced inputs from a legacy proof without recorded configuration', async () => {
    advance();
    mocks.proof.mockResolvedValue({ ...frozen(), configurationHash: null });
    expect(await verifyCurrentReplay()).toBe(false);
    expect(mocks.derived).not.toHaveBeenCalled();
  });
  it('rejects a latest failed frozen replay', async () => {
    advance();
    mocks.proof.mockResolvedValue({ ...frozen(), status: 'FAILED' });
    expect(await verifyCurrentReplay()).toBe(false);
    expect(mocks.record).toHaveBeenLastCalledWith(
      'DERIVED_REPLAY_STABLE',
      'FAILED',
      expect.any(String),
      expect.any(Object),
    );
  });
  it('rejects corrupt frozen A/B fingerprints', async () => {
    mocks.proof.mockResolvedValue({ ...frozen(), replayB: {} });
    expect(await verifyCurrentReplay()).toBe(false);
  });
  it('requires healthy live workers', async () => {
    advance();
    mocks.controls.mockResolvedValue([]);
    expect(await verifyCurrentReplay()).toBe(false);
    expect(mocks.derived).not.toHaveBeenCalled();
  });
  it('does not mistake disabled controls for drained worker locks', async () => {
    advance();
    mocks.locks.mockResolvedValue([{ acquired: false }]);
    expect(await verifyCurrentReplay()).toBe(false);
    expect(mocks.derived).not.toHaveBeenCalled();
  });
  it('does not certify an unresolved source import failure warning', async () => {
    advance();
    mocks.sources.mockResolvedValue([
      {
        id: 'runs',
        state: 'LIVE',
        schemaValid: true,
        warning: 'IMPORT_FAILED',
      },
    ]);
    expect(await verifyCurrentReplay()).toBe(false);
  });
  it.each(['ERROR', 'FAILED', 'DEGRADED'])(
    'does not certify unresolved source state %s',
    async (state) => {
      advance();
      mocks.sources.mockResolvedValue([
        { id: 'runs', state, schemaValid: true },
      ]);
      expect(await verifyCurrentReplay()).toBe(false);
    },
  );
  it('does not certify unresolved import rejections', async () => {
    advance();
    mocks.rejections.mockResolvedValue(1);
    expect(await verifyCurrentReplay()).toBe(false);
  });
});
