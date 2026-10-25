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
  vi.resetAllMocks();
  mocks.queue.mockResolvedValue(new Date());
  mocks.process.mockResolvedValue({ processed: 1, failed: 0, deferred: 0 });
  mocks.count.mockResolvedValue(0);
  mocks.progressionCount.mockResolvedValue(0);
  mocks.progression.mockResolvedValue({ processed: 1, failed: 0, deferred: 0 });
});
it('uses a stable per-deployment checkpoint shared by replicas', () => {
  expect(startupReplayId({ RAILWAY_DEPLOYMENT_ID: 'a' })).toBe(
    startupReplayId({ RAILWAY_DEPLOYMENT_ID: 'a' }),
  );
  expect(startupReplayId({ RAILWAY_DEPLOYMENT_ID: 'a' })).not.toBe(
    startupReplayId({ RAILWAY_DEPLOYMENT_ID: 'b' }),
  );
});
it('queues every page and drains remaining work in small batches', async () => {
  mocks.queue.mockResolvedValueOnce(null);
  mocks.count.mockResolvedValueOnce(1).mockResolvedValueOnce(0);
  await recalculateOnStartup(new AbortController().signal);
  expect(mocks.queue).toHaveBeenCalledTimes(3);
  expect(mocks.process).toHaveBeenCalledTimes(3);
  expect(mocks.process).toHaveBeenCalledWith(10, expect.any(Function));
  expect(mocks.queue).toHaveBeenCalledWith(
    false,
    expect.stringContaining('startup:'),
  );
});
it('refuses mutation when the database binding is wrong', async () => {
  mocks.binding.mockRejectedValue(new Error('binding'));
  await expect(
    recalculateOnStartup(new AbortController().signal),
  ).rejects.toThrow('binding');
  expect(mocks.seed).not.toHaveBeenCalled();
  expect(mocks.queue).not.toHaveBeenCalled();
});
it('leaves failures for bounded retries instead of reporting completion', async () => {
  mocks.process.mockResolvedValue({ processed: 0, failed: 1, deferred: 0 });
  await expect(
    recalculateOnStartup(new AbortController().signal),
  ).rejects.toThrow('COLLECTION_STARTUP_RETRY');
});
it('stops before enqueue on shutdown', async () => {
  const controller = new AbortController();
  controller.abort();
  await recalculateOnStartup(controller.signal);
  expect(mocks.queue).not.toHaveBeenCalled();
});

it('waits for collector achievement jobs after collection jobs drain', async () => {
  mocks.progressionCount.mockResolvedValueOnce(1).mockResolvedValueOnce(0);
  await recalculateOnStartup(new AbortController().signal);
  expect(mocks.progression).toHaveBeenCalledTimes(2);
  expect(mocks.progression).toHaveBeenCalledWith(
    10,
    expect.any(Function),
    'COLLECTOR',
  );
});
it('retries achievement failures instead of reporting completion', async () => {
  mocks.progression.mockResolvedValue({ processed: 0, failed: 1, deferred: 0 });
  await expect(
    recalculateOnStartup(new AbortController().signal),
  ).rejects.toThrow('COLLECTION_STARTUP_RETRY');
});
