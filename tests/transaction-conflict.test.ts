import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isTransactionConflict } from '../src/server/transaction-conflict';
const mock = vi.hoisted(() => ({
  transaction: vi.fn(),
  runCreate: vi.fn(),
  runUpdate: vi.fn(),
  collectionJobs: vi.fn(),
  progressionJobs: vi.fn(),
  collectionUpsert: vi.fn(),
  progressionUpsert: vi.fn(),
}));
vi.mock('@/server/db', () => ({
  db: () => ({
    $transaction: mock.transaction,
    syncRun: { create: mock.runCreate, update: mock.runUpdate },
    collectionJob: {
      findMany: mock.collectionJobs,
      upsert: mock.collectionUpsert,
    },
    progressionJob: {
      findMany: mock.progressionJobs,
      upsert: mock.progressionUpsert,
    },
  }),
}));
beforeEach(() => {
  vi.resetAllMocks();
  mock.runCreate.mockResolvedValue({ id: 'run' });
  mock.runUpdate.mockResolvedValue({});
  mock.collectionJobs.mockResolvedValue([{ collectorId: 'collector' }]);
  mock.progressionJobs.mockResolvedValue([
    { subjectType: 'COLLECTOR', subjectId: 'collector' },
  ]);
});
describe('retryable projection contention', () => {
  it('recognizes PostgreSQL and Prisma adapter conflict codes without message guessing', () => {
    for (const error of [
      { code: 'P2034' },
      { code: '40001' },
      { code: '40P01' },
      {
        meta: {
          driverAdapterError: {
            cause: { originalCode: '40001', kind: 'TransactionWriteConflict' },
          },
        },
      },
    ])
      expect(
        isTransactionConflict(new Error('wrapped', { cause: error })),
      ).toBe(true);
    expect(isTransactionConflict({ code: 'P2002' })).toBe(false);
    expect(isTransactionConflict(new Error('could not serialize access'))).toBe(
      false,
    );
    const cyclic: { cause?: unknown } = {};
    cyclic.cause = cyclic;
    expect(isTransactionConflict(cyclic)).toBe(false);
  });
  it('keeps collection conflicts queued without tripping the failure counter', async () => {
    mock.transaction.mockRejectedValue({ code: 'P2034' });
    const { processCollections } = await import('../src/server/dex-engine');
    for (let attempt = 0; attempt < 3; attempt++)
      expect(await processCollections()).toEqual({
        processed: 0,
        failed: 0,
        deferred: 1,
      });
    expect(mock.collectionUpsert).not.toHaveBeenCalled();
    expect(mock.runUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'INTERRUPTED',
          errorCode: 'TRANSACTION_CONFLICT',
        }),
      }),
    );
  });
  it('also defers progression conflicts, but still counts real evaluation failures', async () => {
    const { processProgression } =
      await import('../src/server/progression-engine');
    mock.transaction.mockRejectedValue({ cause: { originalCode: '40001' } });
    expect(await processProgression()).toEqual({
      processed: 0,
      failed: 0,
      deferred: 1,
    });
    expect(mock.progressionUpsert).not.toHaveBeenCalled();
    mock.transaction.mockRejectedValue({ code: 'P2002' });
    expect(await processProgression()).toEqual({
      processed: 0,
      failed: 1,
      deferred: 0,
    });
    expect(mock.progressionUpsert).toHaveBeenCalledOnce();
  });
});
