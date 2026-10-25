import { beforeEach, expect, it, vi } from 'vitest';
import { setTimeout } from 'node:timers/promises';
const m = vi.hoisted(() => ({
  rows: vi.fn(),
  dirty: vi.fn(),
  count: vi.fn(),
  derive: vi.fn(),
  process: vi.fn(),
}));
vi.mock('node:timers/promises', () => ({
  setTimeout: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../src/server/db', () => ({
  db: () => ({
    squigProvenance: { findMany: m.rows, count: m.dirty },
    progressionJob: { count: m.count },
  }),
}));
vi.mock('../src/sync/provenance', () => ({ deriveToken: m.derive }));
vi.mock('../src/server/progression-engine', () => ({
  processProgression: m.process,
}));
import { recalculateSquigsOnStartup } from '../src/server/squig-startup';
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(setTimeout).mockResolvedValue(undefined);
  m.rows.mockResolvedValue([]);
  m.dirty.mockResolvedValue(0);
  m.count.mockResolvedValue(0);
  m.process.mockResolvedValue({ processed: 1, failed: 0, deferred: 0 });
});
it('rebuilds the ledger projection before draining Squig achievements', async () => {
  m.rows.mockResolvedValueOnce([{ squigId: 'minted' }]);
  await recalculateSquigsOnStartup(new AbortController().signal);
  expect(m.derive).toHaveBeenCalledWith('minted');
  expect(m.derive.mock.invocationCallOrder[0]).toBeLessThan(
    m.process.mock.invocationCallOrder[0],
  );
  expect(m.process).toHaveBeenCalledWith(10, expect.any(Function), 'SQUIG', 3);
});
it('continues through batches until both durable queues drain', async () => {
  m.rows.mockResolvedValueOnce([{ squigId: 'first' }]);
  m.dirty.mockResolvedValueOnce(1);
  await recalculateSquigsOnStartup(new AbortController().signal);
  expect(m.process).toHaveBeenCalledTimes(2);
});
it('does not report success for exhausted achievements', async () => {
  m.count.mockResolvedValueOnce(1).mockResolvedValueOnce(0);
  await expect(
    recalculateSquigsOnStartup(new AbortController().signal),
  ).rejects.toThrow('SQUIG_STARTUP_BLOCKED');
});
it('bounds contention instead of spinning indefinitely', async () => {
  m.count.mockResolvedValue(1);
  m.process.mockResolvedValue({ processed: 0, failed: 0, deferred: 1 });
  await expect(
    recalculateSquigsOnStartup(new AbortController().signal),
  ).rejects.toThrow('SQUIG_STARTUP_STALLED');
  expect(m.process).toHaveBeenCalledTimes(5);
});
it('does not let one failing projection skip healthy rows', async () => {
  m.rows.mockResolvedValueOnce([{ squigId: 'bad' }, { squigId: 'good' }]);
  m.derive.mockRejectedValueOnce(new Error('private database detail'));
  await recalculateSquigsOnStartup(new AbortController().signal);
  expect(m.derive).toHaveBeenCalledWith('good');
});
it('leaves durable work untouched on shutdown', async () => {
  const c = new AbortController();
  c.abort();
  await recalculateSquigsOnStartup(c.signal);
  expect(m.rows).not.toHaveBeenCalled();
  expect(m.process).not.toHaveBeenCalled();
});
