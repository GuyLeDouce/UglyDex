import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({
  transaction: vi.fn(),
  verifyDerived: vi.fn(),
  migrationChecks: vi.fn(),
  workerControls: vi.fn(),
  enabledContracts: vi.fn(),
  deploymentIdentities: vi.fn(),
  collectibles: vi.fn(),
  privateCollectors: vi.fn(),
  squigs: vi.fn(),
  raw: vi.fn(),
  dirtyProvenance: vi.fn(),
  progressionJobs: vi.fn(),
  collectionJobs: vi.fn(),
  attributionJobs: vi.fn(),
}));

const client = {
  workerControl: { findMany: mock.workerControls },
  editionContract: { count: mock.enabledContracts },
  deploymentIdentity: { count: mock.deploymentIdentities },
  squig: { findMany: mock.squigs },
  squigProvenance: { count: mock.dirtyProvenance },
  progressionJob: { count: mock.progressionJobs },
  collectionJob: { count: mock.collectionJobs },
  activityAttributionJob: { count: mock.attributionJobs },
  collector: { findMany: mock.privateCollectors },
  $queryRaw: mock.raw,
  $transaction: mock.transaction,
};

vi.mock('../src/server/db', () => ({ db: () => client }));
vi.mock('../src/server/derived-verification', () => ({
  verifyDerived: mock.verifyDerived,
}));
vi.mock('../src/server/production', () => ({
  migrationChecks: mock.migrationChecks,
}));
vi.mock('../src/server/collectibles-verify', () => ({
  verifyCollectibles: mock.collectibles,
}));
vi.mock('../src/server/sharing', () => ({ shareCard: vi.fn() }));
vi.mock('../src/domain/sharing', () => ({
  shareSchema: { parse: (value: unknown) => value },
}));

import { databaseFingerprint } from '../src/domain/deployment';
import { productionVerify } from '../src/server/production-verify';
import type { DerivedReadClient } from '../src/server/derived-verification';

const stagingUrl = 'postgresql://user:password@staging.example/db';
const restoreUrl =
  'postgresql://user:password@restore.example/uglydex_restore_test123';
const sourceFingerprint = databaseFingerprint(stagingUrl);

function stubContainedEnvironment(source = sourceFingerprint) {
  vi.stubEnv('DATABASE_URL', restoreUrl);
  vi.stubEnv('APP_ENV', 'development');
  vi.stubEnv('RESTORE_DRILL_CONFIRM', 'RESTORE_INTO_EMPTY_DISPOSABLE_DATABASE');
  mock.workerControls.mockResolvedValue([{ mode: 'DISABLED' }]);
  mock.enabledContracts.mockResolvedValue(0);
  mock.deploymentIdentities.mockResolvedValue(0);
  return source;
}

describe('productionVerify restore mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mock.migrationChecks.mockResolvedValue([]);
    mock.verifyDerived.mockResolvedValue([
      { name: 'progression.replay', status: 'PASS', detail: 'ok' },
      { name: 'collections.replay', status: 'PASS', detail: 'ok' },
    ]);
    mock.squigs.mockResolvedValue([]);
    mock.raw.mockResolvedValue([{ n: 0n }]);
    mock.dirtyProvenance.mockResolvedValue(0);
    mock.progressionJobs.mockResolvedValue(0);
    mock.collectionJobs.mockResolvedValue(0);
    mock.attributionJobs.mockResolvedValue(0);
    mock.privateCollectors.mockResolvedValue([]);
    mock.collectibles.mockResolvedValue([]);
    mock.transaction.mockImplementation(
      async (run: (tx: object) => Promise<unknown>) => run({}),
    );
  });

  afterEach(() => vi.unstubAllEnvs());

  it('keeps normal verification inside the existing repeatable-read transaction', async () => {
    await productionVerify();
    expect(mock.transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'RepeatableRead',
      timeout: 1800000,
    });
    expect(mock.verifyDerived).toHaveBeenCalledTimes(1);
  });

  it('rejects a worker control that is not disabled', async () => {
    const source = stubContainedEnvironment();
    mock.workerControls.mockResolvedValue([{ mode: 'LIVE' }]);
    await expect(
      productionVerify({
        containedRestore: true,
        sourceDatabaseFingerprint: source,
      }),
    ).rejects.toThrow('RESTORE_DATABASE_NOT_CONTAINED');
  });

  it('rejects an enabled edition contract', async () => {
    const source = stubContainedEnvironment();
    mock.enabledContracts.mockResolvedValue(1);
    await expect(
      productionVerify({
        containedRestore: true,
        sourceDatabaseFingerprint: source,
      }),
    ).rejects.toThrow('RESTORE_DATABASE_NOT_CONTAINED');
  });

  it('rejects a remaining deployment identity', async () => {
    const source = stubContainedEnvironment();
    mock.deploymentIdentities.mockResolvedValue(1);
    await expect(
      productionVerify({
        containedRestore: true,
        sourceDatabaseFingerprint: source,
      }),
    ).rejects.toThrow('RESTORE_DATABASE_NOT_CONTAINED');
  });

  it('rejects the source staging database fingerprint', async () => {
    const sameDatabase = databaseFingerprint(restoreUrl);
    stubContainedEnvironment(sameDatabase);
    await expect(
      productionVerify({
        containedRestore: true,
        sourceDatabaseFingerprint: sameDatabase,
      }),
    ).rejects.toThrow('RESTORE_DATABASE_NOT_CONTAINED');
  });

  it('runs the existing full derived verifier in static mode without an interactive transaction', async () => {
    const source = stubContainedEnvironment();
    await productionVerify({
      containedRestore: true,
      sourceDatabaseFingerprint: source,
    });
    expect(mock.verifyDerived).toHaveBeenCalledWith(client);
    expect(mock.transaction).not.toHaveBeenCalled();
  });

  it('reports contained mode, duration, and derived replay outcomes', async () => {
    const source = stubContainedEnvironment();
    const checks = await productionVerify({
      containedRestore: true,
      sourceDatabaseFingerprint: source,
    });
    expect(
      checks.find((check) => check.name === 'restore.contained_static'),
    ).toMatchObject({
      status: 'PASS',
      detail: expect.stringMatching(
        /containment passed; mode=CONTAINED_STATIC_RESTORE; derivedVerificationMs=\d+; progression\.replay=PASS; collections\.replay=PASS/,
      ),
    });
  });
});

describe('verifyDerived read-only behavior', () => {
  it('checks both subject catalogs and performs no writes', async () => {
    const { verifyDerived: actualVerifyDerived } = await vi.importActual<
      typeof import('../src/server/derived-verification')
    >('../src/server/derived-verification');
    const writes = vi.fn();
    const writeMethods = new Set([
      'create',
      'createMany',
      'update',
      'updateMany',
      'upsert',
      'delete',
      'deleteMany',
    ]);
    const delegate = new Proxy(
      {},
      {
        get: (_target, key) =>
          writeMethods.has(String(key))
            ? writes
            : key === 'findMany'
              ? async () => []
              : async () => null,
      },
    );
    const readClient = new Proxy(
      {},
      { get: () => delegate },
    ) as DerivedReadClient;

    const checks = await actualVerifyDerived(readClient);
    expect(checks.map((check) => check.name)).toEqual([
      'progression.replay',
      'collections.replay',
    ]);
    expect(checks.every((check) => check.status === 'PASS')).toBe(true);
    expect(writes).not.toHaveBeenCalled();
  });
});
