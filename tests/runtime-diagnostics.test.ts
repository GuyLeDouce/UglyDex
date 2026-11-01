import { beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  query: vi.fn(),
  end: vi.fn(),
  log: vi.fn(),
}));
vi.mock('pg', () => ({
  Client: class {
    connect = async () => {};
    query = state.query;
    end = state.end;
  },
}));
vi.mock('../src/server/log', () => ({ log: state.log }));
import { reportRuntimeDiagnostics } from '../src/server/runtime-diagnostics';
beforeEach(() => {
  state.query.mockReset().mockResolvedValue({ rows: [] });
  state.end.mockReset().mockResolvedValue(undefined);
  state.log.mockReset();
});
it('runs diagnostics inside a read-only transaction and closes the connection', async () => {
  await reportRuntimeDiagnostics();
  expect(state.query.mock.calls[0][0]).toContain('READ ONLY');
  expect(state.query.mock.calls.at(-1)?.[0]).toBe('ROLLBACK');
  expect(state.end).toHaveBeenCalledOnce();
});
it('does not expose raw database errors or prevent startup', async () => {
  state.query.mockRejectedValueOnce(
    Object.assign(new Error('password=secret collector=private'), {
      code: '42P01',
    }),
  );
  await expect(reportRuntimeDiagnostics()).resolves.toBeUndefined();
  expect(state.log).toHaveBeenCalledWith('runtime.diagnostics_failed', {
    stage: 'connect',
    code: '42P01',
  });
  expect(JSON.stringify(state.log.mock.calls)).not.toContain('secret');
  expect(state.end).toHaveBeenCalledOnce();
});
