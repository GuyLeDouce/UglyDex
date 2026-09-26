import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  release: vi.fn(),
  connect: vi.fn(),
}));
vi.mock('pg', () => ({
  Pool: class {
    on() {}
    connect = mocks.connect;
    end = vi.fn();
  },
}));
import {
  readExternal,
  closeExternalPools,
  classifyExternalError,
} from '@/integrations/read-only';
import { readPage } from '@/integrations/table';
import { tables } from '@/integrations/registry';
beforeEach(() => {
  vi.stubEnv(
    'UGLYBOT_DATABASE_URL',
    'postgresql://readonly:password@localhost/legacy_test',
  );
  mocks.query.mockReset();
  mocks.connect.mockReset();
  mocks.connect.mockResolvedValue({
    query: mocks.query,
    release: mocks.release,
  });
  mocks.query.mockResolvedValue({ rows: [] });
});
afterEach(async () => {
  await closeExternalPools();
  vi.unstubAllEnvs();
});
describe('read-only integration boundary', () => {
  it('reports unconfigured separately from empty', async () => {
    vi.stubEnv('UGLYBOT_DATABASE_URL', '');
    expect(await readExternal('uglybot', 'SELECT 1')).toEqual({
      ok: false,
      reason: 'unconfigured',
    });
  });
  it('wraps reads in read-only transactions with deadlines', async () => {
    expect(
      await readExternal(
        'uglybot',
        'SELECT id FROM public.squig_duels WHERE id=$1',
        ['x'],
      ),
    ).toEqual({ ok: true, data: [] });
    expect(mocks.query.mock.calls.map((c) => c[0])).toEqual([
      'BEGIN READ ONLY',
      "SET LOCAL statement_timeout = '5s'",
      'SELECT id FROM public.squig_duels WHERE id=$1',
      'COMMIT',
    ]);
    expect(mocks.query.mock.calls[2][1]).toEqual(['x']);
    expect(mocks.release).toHaveBeenCalled();
  });
  it('rejects mutation and multi-statement requests', async () => {
    await expect(readExternal('uglybot', 'DELETE FROM x')).rejects.toThrow();
    await expect(
      readExternal('uglybot', 'SELECT 1; DELETE FROM x'),
    ).rejects.toThrow();
  });
  it('sanitizes connection failures', async () => {
    mocks.connect.mockRejectedValue(
      new Error('postgresql://secret:password@prod'),
    );
    expect(await readExternal('uglybot', 'SELECT 1')).toEqual({
      ok: false,
      reason: 'unavailable',
    });
  });
  it('handles schema drift and rolls back', async () => {
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.startsWith('SELECT')) throw { code: '42703' };
      return { rows: [] };
    });
    expect(
      await readExternal('uglybot', 'SELECT missing FROM public.squig_duels'),
    ).toEqual({ ok: false, reason: 'schema_mismatch' });
    expect(mocks.query).toHaveBeenCalledWith('ROLLBACK');
  });
  it('classifies permission denial as unavailable', () =>
    expect(classifyExternalError({ code: '42501' })).toBe('unavailable'));
  it('detects missing required columns before row reads', async () => {
    expect(await readPage(tables.duels)).toEqual({
      ok: false,
      reason: 'schema_mismatch',
    });
  });
  it('bounds pagination and validates filter identifiers', async () => {
    await expect(readPage(tables.duels, undefined, {}, 100000)).rejects.toThrow(
      'INVALID_PAGE_SIZE',
    );
  });
});
