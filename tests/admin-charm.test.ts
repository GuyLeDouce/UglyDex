import { describe, expect, it } from 'vitest';
import { adminCharmDiagnostic } from '@/domain/admin-charm';
const now = new Date('2026-11-11T12:00:00Z');
const base: Parameters<typeof adminCharmDiagnostic>[0] = {
  consent: true,
  authenticated: true,
  configured: true,
  currencyId: 'currency',
  commit: 'release',
  staleAfter: 300000,
  balance: null,
  request: { pending: true, requestedAt: now, nextUserRequestAt: now },
  sync: {
    currencyId: 'currency',
    alignmentHash: 'proof',
    alignmentCommit: 'release',
    errorCode: null,
    lastSuccessAt: now,
    nextRequestAt: now,
    month: '2026-11',
    monthRequests: 1,
  },
  worker: { mode: 'HISTORICAL', lastHeartbeat: now },
};
describe('owner balance diagnostics', () => {
  it('never converts an absent balance into zero or claims processing', () => {
    const result = adminCharmDiagnostic(base, now);
    expect(result.savedBalance).toBeNull();
    expect(result.state).toBe('QUEUED');
    expect(result.reason).toContain('does not record');
  });
  it('preserves real zero and decimal precision and recognizes fulfilled requests', () => {
    for (const value of ['0', '123456789123456789.123456789']) {
      const result = adminCharmDiagnostic(
        {
          ...base,
          balance: {
            balance: value,
            status: 'CURRENT',
            observedAt: now,
            lastApiSuccessAt: now,
          },
        },
        now,
      );
      expect(result.savedBalance).toBe(value);
      expect(result.holderBalance).toBe(value);
      expect(result.state).toBe('IDLE');
    }
  });
  it('reports deployment alignment as a blocker without hiding the cached balance', () => {
    const result = adminCharmDiagnostic(
      {
        ...base,
        balance: { balance: '12', status: 'CURRENT', observedAt: new Date(0) },
        sync: { ...base.sync!, alignmentCommit: 'old' },
      },
      now,
    );
    expect(result.state).toBe('BLOCKED');
    expect(result.reason).toContain('deployment');
    expect(result.savedBalance).toBe('12');
    expect(result.stale).toBe(true);
  });
  it('separates shared failures from individual request failures', () => {
    const result = adminCharmDiagnostic(
      { ...base, sync: { ...base.sync!, errorCode: 'DRIP_HTTP_403' } },
      now,
    );
    expect(result.state).toBe('FAILED');
    expect(result.reason).toContain('not proof');
    expect(result.sharedError).toBe('DRIP_HTTP_403');
  });
  it('distinguishes opt-out, missing authentication, and stale worker heartbeats', () => {
    expect(
      adminCharmDiagnostic({ ...base, consent: false }, now).holderBalance,
    ).toBeNull();
    expect(
      adminCharmDiagnostic({ ...base, authenticated: false }, now).reason,
    ).toContain('authenticated Discord');
    expect(
      adminCharmDiagnostic(
        { ...base, worker: { mode: 'LIVE', lastHeartbeat: new Date(0) } },
        now,
      ).state,
    ).toBe('BLOCKED');
  });
  it('shows backoff and current-month budget exhaustion', () => {
    expect(
      adminCharmDiagnostic(
        {
          ...base,
          sync: { ...base.sync!, nextRequestAt: new Date(+now + 60000) },
        },
        now,
      ).reason,
    ).toContain('schedule');
    expect(
      adminCharmDiagnostic(
        { ...base, sync: { ...base.sync!, monthRequests: 30000 } },
        now,
      ).reason,
    ).toContain('budget');
  });
});
