import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  binding: vi.fn(),
  seed: vi.fn(),
  queue: vi.fn(),
  process: vi.fn(),
  count: vi.fn(),
  progression: vi.fn(),
  progressionCount: vi.fn(),
}));
vi.mock('../src/server/squig-startup', () => ({
  recalculateSquigsOnStartup: vi.fn(),
}));
vi.mock('node:timers/promises', () => ({
  setTimeout: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../src/server/deployment', () => ({
  assertDeploymentBinding: mocks.binding,
}));
vi.mock('../src/server/db', () => ({
  db: () => ({
    collectionJob: { count: mocks.count },
    progressionJob: { count: mocks.progressionCount },
  }),
}));
vi.mock('../src/server/dex-engine', () => ({
  seedCollections: mocks.seed,
  queueCollections: mocks.queue,
  processCollections: mocks.process,
}));
vi.mock('../src/server/progression-engine', () => ({
  seedProgression: vi.fn(),
  processProgression: mocks.progression,
}));
import {
  recalculateOnStartup,
  startupReplayId,
} from '../src/server/collection-startup';
beforeEach(() => {
  vi.clearAllMocks();
  mocks.binding.mockReset();
  mocks.queue.mockReset();
  mocks.process.mockReset();
  mocks.count.mockReset();
  mocks.progressionCount.mockReset();
  mocks.progression.mockReset();
  mocks.queue.mockResolvedValue(new Date());
  mocks.process.mockResolvedValue({ processed: 1, failed: 0, deferred: 0 });
  mocks.count.mockResolvedValue(0);
  mocks.progressionCount.mockResolvedValue(0);
  mocks.progression.mockResolvedValue({ processed: 1, failed: 0, deferred: 0 });
});
it('shares stable deployment checkpoints but revisits new deployments', () => {
  expect(startupReplayId({ RAILWAY_DEPLOYMENT_ID: 'a' })).toBe(
    startupReplayId({ RAILWAY_DEPLOYMENT_ID: 'a' }),
  );
  expect(startupReplayId({ RAILWAY_DEPLOYMENT_ID: 'a' })).not.toBe(
    startupReplayId({ RAILWAY_DEPLOYMENT_ID: 'b' }),
  );
});
it('continues enqueueing beyond failed batches and applies per-job budgets', async () => {
  mocks.queue.mockResolvedValueOnce(null);
  mocks.process.mockResolvedValueOnce({ processed: 9, failed: 1, deferred: 0 });
  await recalculateOnStartup(new AbortController().signal);
  expect(mocks.queue).toHaveBeenCalledTimes(2);
  expect(mocks.process).toHaveBeenCalledWith(10, expect.any(Function), 3);
});
it('refuses mutation when the database binding is wrong', async () => {
  mocks.binding.mockRejectedValue(new Error('binding'));
  await expect(
    recalculateOnStartup(new AbortController().signal),
  ).rejects.toThrow('binding');
  expect(mocks.seed).not.toHaveBeenCalled();
});
it('does not report completion while exhausted failures remain', async () => {
  mocks.count.mockResolvedValueOnce(0).mockResolvedValueOnce(2);
  await expect(
    recalculateOnStartup(new AbortController().signal),
  ).rejects.toThrow('COLLECTION_STARTUP_BLOCKED');
});
it('stops before enqueue on shutdown', async () => {
  const controller = new AbortController();
  controller.abort();
  await recalculateOnStartup(controller.signal);
  expect(mocks.queue).not.toHaveBeenCalled();
});
it('drains remaining collector achievements', async () => {
  mocks.progressionCount.mockResolvedValueOnce(1).mockResolvedValueOnce(1);
  await recalculateOnStartup(new AbortController().signal);
  expect(mocks.progression).toHaveBeenCalledTimes(2);
  expect(mocks.progression).toHaveBeenCalledWith(
    10,
    expect.any(Function),
    'COLLECTOR',
    3,
  );
});
it('retries temporary contention without aborting the pass', async () => {
  mocks.process.mockResolvedValueOnce({ processed: 0, failed: 0, deferred: 1 });
  mocks.count.mockResolvedValueOnce(1).mockResolvedValueOnce(1);
  await recalculateOnStartup(new AbortController().signal);
  expect(mocks.process).toHaveBeenCalledTimes(2);
});
it('bounds repeated contention with no forward progress', async () => {
  mocks.process.mockResolvedValue({ processed: 0, failed: 0, deferred: 1 });
  mocks.progression.mockResolvedValue({ processed: 0, failed: 0, deferred: 0 });
  mocks.count.mockResolvedValue(1);
  await expect(
    recalculateOnStartup(new AbortController().signal),
  ).rejects.toThrow('COLLECTION_STARTUP_STALLED');
  expect(mocks.process).toHaveBeenCalledTimes(5);
});
