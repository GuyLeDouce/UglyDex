import { describe, it, expect } from 'vitest';
import {
  profileHealth,
  jobHealth,
  pendingCharmHealth,
  charmRequestTime,
  discordProofSatisfied,
} from '@/domain/admin-health';
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

describe('superseded health records', () => {
  const requestedAt = new Date('2026-10-19T14:23:54Z');
  const now = new Date('2026-11-11T12:00:00Z');
  const request = {
    requestedAt,
    nextUserRequestAt: new Date(+requestedAt + 120000),
  };
  const balance = {
    status: 'CURRENT',
    balance: '0',
    observedAt: now,
    lastApiSuccessAt: now,
  };
  it('ignores a legacy pending row fulfilled by a newer successful balance read', () => {
    expect(pendingCharmHealth(request, [balance], true, now)).toBeNull();
    expect(pendingCharmHealth(request, [], true, now)?.error).toBe(true);
    expect(
      pendingCharmHealth(
        request,
        [{ ...balance, status: 'UNRESOLVED' }],
        true,
        now,
      )?.error,
    ).toBe(true);
  });
  it('does not use an old balance to clear a newer user request', () => {
    const newer = { ...request, nextUserRequestAt: new Date(+now + 180000) };
    expect(+charmRequestTime(newer)).toBe(+now + 60000);
    expect(
      pendingCharmHealth(newer, [balance], true, new Date(+now + 60000)),
    ).not.toBeNull();
  });
  it('does not treat an opted-out collector as waiting for a balance', () => {
    expect(pendingCharmHealth(request, [], false, now)).toBeNull();
  });
  it('requires OAuth proof of the specific Discord account in the review', () => {
    const evidence = { discordIds: ['333333333333333333'] };
    expect(
      discordProofSatisfied(evidence, [
        { externalId: '333333333333333333', authenticatedAt: now },
      ]),
    ).toBe(true);
    expect(
      discordProofSatisfied(evidence, [
        { externalId: '333333333333333333', authenticatedAt: null },
      ]),
    ).toBe(false);
    expect(
      discordProofSatisfied(evidence, [
        { externalId: '999999999999999999', authenticatedAt: now },
      ]),
    ).toBe(false);
    expect(
      discordProofSatisfied({}, [
        { externalId: '333333333333333333', authenticatedAt: now },
      ]),
    ).toBe(false);
  });
});
