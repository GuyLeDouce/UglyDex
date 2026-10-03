import { afterEach, describe, expect, it, vi } from 'vitest';

const { migrationChecks } = vi.hoisted(() => ({
  migrationChecks: vi.fn(),
}));

vi.mock('@/server/production', () => ({ migrationChecks }));

import { GET } from '@/app/api/ready/route';

describe('GET /api/ready', () => {
  afterEach(() => vi.restoreAllMocks());

  it('logs failed check names without returning details publicly', async () => {
    migrationChecks.mockResolvedValue([
      {
        name: 'migration.checksums',
        status: 'FAIL',
        detail: 'private migration detail',
      },
    ]);
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await GET();

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: 'not_ready' });
    expect(log).toHaveBeenCalledWith(
      JSON.stringify({
        event: 'readiness.blocked',
        checks: ['migration.checksums'],
      }),
    );
    expect(log.mock.calls.flat().join(' ')).not.toContain(
      'private migration detail',
    );
  });

  it('keeps readiness exceptions generic while logging only the error type', async () => {
    migrationChecks.mockRejectedValue(new Error('private connection details'));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await GET();

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: 'not_ready' });
    expect(log).toHaveBeenCalledWith(
      JSON.stringify({
        event: 'readiness.check_error',
        errorType: 'Error',
      }),
    );
    expect(log.mock.calls.flat().join(' ')).not.toContain(
      'private connection details',
    );
  });

  it('returns ready when all migration checks pass', async () => {
    migrationChecks.mockResolvedValue([
      { name: 'migration.pending', status: 'PASS', detail: '11 applied' },
    ]);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ready' });
  });
});
