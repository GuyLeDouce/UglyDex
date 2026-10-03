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
const inputs = {
    CollectorActivity: { count: 1, sha256: 'input' },
    ProgressionRuleset: {
      count: 1,
      sha256:
        '04eb87c3edd95874ec224949aabfd5d1a12231491e9f0cfa6d84425d56e8742f',
    },
    CollectionRuleset: {
      count: 1,
      sha256:
        '8e4ddedf18fc7bb66ad37d0f76d8060e3a45ebacd403626849d353e60553d817',
    },
    AchievementDefinition: {
      count: 65,
      sha256:
        '312fdb054f7d05f06642359c4f517b49ed118e2a559dcb934874670ad3c298af',
    },
    CollectionSetDefinition: {
      count: 52,
      sha256:
        'a8960623ae7790457bce47270fe93cb405f072525d1635c73f145f09598732dd',
    },
    CollectionSetRequirement: {
      count: 81,
      sha256:
        '312ac4a83d79b9dd7349b74888df2c70682db2e59b54e2a0e083a6ee591f3365',
    },
    CosmeticDefinition: {
      count: 17,
      sha256:
        '37e415220c540864414a2399562c1b0c5784958e394f743e3b21e0ee47323a3c',
    },
  },
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
const reviewedFrozen = () => ({
  ...frozen(),
  id: 'b6a1d45d-d9fc-454a-9771-37da3cb450c1',
  commit: 'cd15cd36c835be38b316ea7bd6fc9c45bab0f77f',
  inputHash: '83b5ec1c293e1452ee560ddd3afd35da72a6c2d61494b3273184d7419f7162f1',
  configurationHash: null,
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
  it('accepts the reviewed Phase 11 frozen revision with matching rules and catalogs', async () => {
    mocks.proof.mockResolvedValue(reviewedFrozen());
    advance();
    expect(await verifyCurrentReplay()).toBe(true);
    expect(mocks.derived).toHaveBeenCalled();
    expect(mocks.provenance).toHaveBeenCalled();
  });
  it('requires review for an unregistered frozen derivation revision', async () => {
    mocks.proof.mockResolvedValue({ ...frozen(), commit: 'b'.repeat(40) });
    expect(await verifyCurrentReplay()).toBe(false);
    expect(mocks.derived).not.toHaveBeenCalled();
  });
  it('verifies advanced inputs with independent read-only recomputation and saves the captured boundary', async () => {
    mocks.proof.mockResolvedValue(reviewedFrozen());
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
        frozenProofId: 'b6a1d45d-d9fc-454a-9771-37da3cb450c1',
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
  it.each([
    'ProgressionRuleset',
    'CollectionRuleset',
    'AchievementDefinition',
    'CollectionSetDefinition',
    'CollectionSetRequirement',
    'CosmeticDefinition',
  ])('requires review when legacy frozen %s changes', async (name) => {
    mocks.proof.mockResolvedValue(reviewedFrozen());
    mocks.fingerprints.mockImplementation(async (_client, mode) =>
      mode === 'input'
        ? { ...inputs, [name]: { count: 1, sha256: 'changed' } }
        : outputs,
    );
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
