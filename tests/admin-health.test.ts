import { describe, it, expect } from 'vitest';
import { profileHealth, jobHealth } from '@/domain/admin-health';
describe('automatic profile health', () => {
  const now = new Date('2026-11-11T00:00:00Z');
  it('transitions automatically from queued to failed to healthy', () => {
    const queued = { queuedAt: now, errorCode: null, attempts: 0 };
    expect(profileHealth([jobHealth('Sets', queued, now)]).status).toBe(
      'UPDATING',
    );
    expect(
      profileHealth([
        jobHealth('Sets', { ...queued, errorCode: 'FAILED', attempts: 2 }, now),
      ]).status,
    ).toBe('ERROR');
    expect(profileHealth([]).status).toBe('ACTIVE');
  });
  it('prioritizes errors while retaining every explanation', () => {
    const result = profileHealth([
      { message: 'Queued' },
      { error: true, message: 'Identity conflict' },
    ]);
    expect(result.status).toBe('ERROR');
    expect(result.details).toEqual(['Queued', 'Identity conflict']);
  });
  it('calls out stalled work with a timestamp instead of claiming it is active', () => {
    const result = jobHealth(
      'Sets',
      { queuedAt: new Date(+now - 3600001), errorCode: null, attempts: 3 },
      now,
    );
    expect(result.error).toBe(true);
    expect(result.message).toContain('more than one hour');
    expect(result.message).toContain('attempts: 3');
  });
});
