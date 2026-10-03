import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  dripBudget,
  balanceView,
  publicCharm,
  charmFilter,
  dripHeaderSpacing,
} from '../src/domain/charm';
import {
  charmDirtySchema,
  dirtySignature,
  verifyDirtySignature,
} from '../src/domain/charm-dirty';
describe('conservative DRIP budget and private balance', () => {
  const now = new Date('2026-09-28T00:00:00Z');
  it('honors lower shared limits and longer windows without raising its ceiling', () => {
    expect(dripHeaderSpacing({ limit: 24, window: 60 })).toBe(10000);
    expect(dripHeaderSpacing({ limit: 2, window: 60 })).toBe(30000);
    expect(dripHeaderSpacing({ limit: 24, window: 3600 })).toBe(150000);
  });
  it('reserves no more than six requests each minute', () => {
    let state = { month: '2026-09', monthRequests: 0, nextRequestAt: now };
    let allowed = 0;
    for (let offset = 0; offset < 60000; offset += 100) {
      const next = dripBudget(state, new Date(+now + offset));
      if (next.allowed) {
        allowed++;
        state = next;
      }
    }
    expect(allowed).toBe(6);
  });
  it('preserves reservation across restart', () =>
    expect(
      dripBudget(
        {
          month: '2026-09',
          monthRequests: 1,
          nextRequestAt: new Date(+now + 10000),
        },
        now,
      ).allowed,
    ).toBe(false));
  it('stops at monthly soft budget', () =>
    expect(
      dripBudget(
        { month: '2026-09', monthRequests: 30000, nextRequestAt: now },
        now,
      ).allowed,
    ).toBe(false));
  it('resets monthly usage without resetting a pending cooldown', () =>
    expect(
      dripBudget(
        {
          month: '2026-08',
          monthRequests: 30000,
          nextRequestAt: new Date(+now + 10000),
        },
        now,
      ),
    ).toMatchObject({ allowed: false, monthRequests: 1 }));
  it('rejects a rate above the owned ceiling', () =>
    expect(() =>
      dripBudget(
        { month: '2026-09', monthRequests: 0, nextRequestAt: now },
        now,
        7,
      ),
    ).toThrow());
  it('unknown never becomes zero', () =>
    expect(balanceView(null, now)).toMatchObject({
      balance: null,
      status: 'UNKNOWN',
      stale: true,
    }));
  it('retains last known value when stale or error', () =>
    expect(
      balanceView(
        {
          balance: '12.3',
          observedAt: new Date(+now - 600000),
          status: 'ERROR',
        },
        now,
      ),
    ).toMatchObject({ balance: '12.3', stale: true }));
  it('fresh cache is current', () =>
    expect(
      balanceView({ balance: '0', observedAt: now, status: 'CURRENT' }, now)
        .stale,
    ).toBe(false));
  it('balance is private unless explicitly opted in', () => {
    const value = balanceView(
      { balance: '99', observedAt: now, status: 'CURRENT' },
      now,
    );
    expect(publicCharm(false, value)).toBeNull();
    expect(publicCharm(true, value)?.balance).toBe('99');
  });
  it('never publishes a balance after exact identity resolution conflicts', () => {
    for (const status of ['CONFLICT', 'UNRESOLVED']) {
      const value = balanceView(
        { balance: '99', observedAt: now, status },
        now,
      );
      expect(publicCharm(true, value)).toBeNull();
    }
  });
  it('blank activity filters mean all', () =>
    expect(
      charmFilter.parse({ source: '', direction: '', from: '', to: '' }),
    ).toEqual({ page: 1 }));
});
describe('authenticated dirty hints', () => {
  const key = 'fixture-secret-'.repeat(4),
    timestamp = '1790553600',
    now = Number(timestamp) * 1000,
    nonce = randomUUID();
  const payload = {
    realmId: 'a'.repeat(24),
    currencyId: 'b'.repeat(24),
    discordId: '123456789012345678',
    sourceSystem: 'uglybot',
    operationReference: 'test-1',
    observedAt: new Date(now).toISOString(),
  };
  it('accepts a valid HMAC over the exact payload', () =>
    expect(
      verifyDirtySignature(
        key,
        timestamp,
        nonce,
        payload,
        dirtySignature(key, timestamp, nonce, payload),
        now,
      ),
    ).toBe(true));
  it('rejects invalid HMAC', () =>
    expect(
      verifyDirtySignature(key, timestamp, nonce, payload, '0'.repeat(64), now),
    ).toBe(false));
  it('rejects payload tampering', () =>
    expect(
      verifyDirtySignature(
        key,
        timestamp,
        nonce,
        { ...payload, operationReference: 'changed' },
        dirtySignature(key, timestamp, nonce, payload),
        now,
      ),
    ).toBe(false));
  it('rejects expired hints', () =>
    expect(
      verifyDirtySignature(
        key,
        timestamp,
        nonce,
        payload,
        dirtySignature(key, timestamp, nonce, payload),
        now + 120001,
      ),
    ).toBe(false));
  it('rejects supplied balances', () =>
    expect(
      charmDirtySchema.safeParse({ ...payload, balance: '99' }).success,
    ).toBe(false));
  it('requires an exact identity rather than a name', () =>
    expect(
      charmDirtySchema.safeParse({
        ...payload,
        discordId: undefined,
        username: 'alice',
      }).success,
    ).toBe(false));
});
