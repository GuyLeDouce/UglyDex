import { describe, it, expect } from 'vitest';
import {
  normalizeWallet,
  squigToken,
  SQUIGS_CONTRACT,
  walletDisplay,
} from '@/domain/validation';
import { reconcileIdentity } from '@/domain/identity';
import { eventKey, hash, activitySchema } from '@/domain/events';
import { readEnv } from '@/server/env';
import { normalizeRow } from '@/sync/normalize';
import { safeEqual, usableChallenge } from '@/server/auth';
describe('wallet normalization', () => {
  it('compares mixed casing and preserves checksum display', () => {
    expect(normalizeWallet(walletDisplay(SQUIGS_CONTRACT))).toBe(
      SQUIGS_CONTRACT,
    );
  });
  it.each([
    '',
    '0x123',
    'example.eth',
    '0x' + 'z'.repeat(40),
    ' ' + SQUIGS_CONTRACT,
  ])('rejects invalid address %s', (v) =>
    expect(() => normalizeWallet(v)).toThrow(),
  );
});
describe('Squig tokens', () => {
  it.each([1, 4444, '3157'])('accepts collection token %s', (v) =>
    expect(squigToken(v)).toBe(Number(v)),
  );
  it.each([
    0,
    -1,
    4445,
    '01',
    '1e2',
    '1.0',
    ' 1',
    null,
    undefined,
    1.5,
    '999999999999999999999',
  ])('rejects invalid %s', (v) => expect(() => squigToken(v)).toThrow());
});
describe('identity reconciliation', () => {
  const base = { legacyDiscordIds: [], legacyCollectorIds: [] };
  it('never grants legacy-linked account access from a wallet proof', () =>
    expect(
      reconcileIdentity({
        ...base,
        legacyDiscordIds: ['discord'],
        legacyCollectorIds: ['old'],
      }),
    ).toEqual({ action: 'CREATE' }));
  it('uses a proven credential account', () =>
    expect(reconcileIdentity({ ...base, credentialCollectorId: 'a' })).toEqual({
      action: 'USE',
      collectorId: 'a',
    }));
  it('links a fresh credential to the signed in collector', () =>
    expect(reconcileIdentity({ ...base, sessionCollectorId: 'a' })).toEqual({
      action: 'USE',
      collectorId: 'a',
    }));
  it('blocks cross-account linking', () =>
    expect(
      reconcileIdentity({
        ...base,
        sessionCollectorId: 'a',
        credentialCollectorId: 'b',
      }).action,
    ).toBe('REVIEW'));
  it('flags conflicting legacy Discord IDs', () =>
    expect(
      reconcileIdentity({ ...base, legacyDiscordIds: ['a', 'b'] }).action,
    ).toBe('REVIEW'));
  it('does not reactivate a revoked credential', () =>
    expect(reconcileIdentity({ ...base, revoked: true }).action).toBe(
      'REVIEW',
    ));
});
describe('events', () => {
  const event = activitySchema.parse({
    sourceSystem: 'uglybot',
    sourceType: 'duels',
    sourceId: 'duel:1',
    discordId: '123456789012345678',
    eventType: 'DUEL_PARTICIPATED',
    eventAt: '2026-01-01',
    metadata: { status: 'pending' },
  });
  it('keeps replay identity stable as source payload changes', () => {
    expect(eventKey({ ...event, metadata: { status: 'completed' } })).toBe(
      eventKey(event),
    );
    expect(hash({ ...event, metadata: { status: 'completed' } })).not.toBe(
      hash(event),
    );
  });
  it('separates participants and source namespaces', () => {
    expect(eventKey({ ...event, discordId: '123456789012345679' })).not.toBe(
      eventKey(event),
    );
    expect(eventKey({ ...event, sourceSystem: 'gauntlet' })).not.toBe(
      eventKey(event),
    );
  });
  it('hashes object keys consistently', () =>
    expect(hash({ a: 1, b: 2 })).toBe(hash({ b: 2, a: 1 })));
  it('does not assign another collection bounty to a Squig', () =>
    expect(
      normalizeRow('bounty', {
        id: '1',
        sender_discord_id: event.discordId,
        created_at: new Date(),
        status: 'pending',
        contract_address: '0x' + '1'.repeat(40),
        token_id: '1',
        yes_votes: 0,
        no_votes: 0,
        charm_payout_status: null,
      })[0].squigTokenId,
    ).toBeUndefined());
  it('does not turn unreceived Maw sessions into feeds', () =>
    expect(normalizeRow('maw', { received_at: null })).toEqual([]));
  it('rejects missing event time instead of fabricating import time', () =>
    expect(() =>
      normalizeRow('runs', { id: '1', user_id: event.discordId, score: 1 }),
    ).toThrow());
  it('keeps survival at collector level with explicit timestamp basis', () => {
    const e = normalizeRow('survival', {
      game_id: '5',
      user_id: event.discordId,
      started_at: new Date(),
      placement: 1,
      eliminations: 3,
      deaths: 0,
      images_used: 2,
    })[0];
    expect(e.squigTokenId).toBeUndefined();
    expect(e.metadata.timeBasis).toBe('game_started_at');
  });
});
describe('environment boundary', () => {
  const base = {
    DATABASE_URL: 'postgresql://local:local@localhost:5432/uglydex',
  };
  it('requires own DB and never prints supplied secret', () => {
    expect(() => readEnv({})).toThrow('DATABASE_URL');
    expect(() => readEnv({ DATABASE_URL: 'secret-value' })).not.toThrow(
      'secret-value',
    );
  });
  it('accepts absent external services and blank optionals', () =>
    expect(
      readEnv({ ...base, UGLYBOT_DATABASE_URL: '' }).UGLYBOT_DATABASE_URL,
    ).toBeUndefined());
  it('rejects same database with different user credentials', () =>
    expect(() =>
      readEnv({
        ...base,
        UGLYBOT_DATABASE_URL: 'postgres://readonly:other@localhost/uglydex',
      }),
    ).toThrow('UGLYBOT_DATABASE_URL'));
  it('rejects unsafe production origins and callback drift', () => {
    expect(() => readEnv({ ...base, NODE_ENV: 'production' })).toThrow(
      'PUBLIC_BASE_URL',
    );
    expect(() =>
      readEnv({
        ...base,
        DISCORD_REDIRECT_URI: 'https://evil.example/callback',
      }),
    ).toThrow('DISCORD_REDIRECT_URI');
  });
  it('restricts configured contract to the inspected collection', () =>
    expect(() =>
      readEnv({ ...base, SQUIGS_CONTRACT_ADDRESS: '0x' + '1'.repeat(40) }),
    ).toThrow());
});
describe('auth challenge boundaries', () => {
  const live = {
    expiresAt: new Date(Date.now() + 60000),
    consumedAt: null,
    collectorId: null,
  };
  it('rejects expired, consumed and cross-session challenges', () => {
    expect(usableChallenge(live)).toBe(true);
    expect(usableChallenge({ ...live, expiresAt: new Date(0) })).toBe(false);
    expect(usableChallenge({ ...live, consumedAt: new Date() })).toBe(false);
    expect(usableChallenge(live, 'another')).toBe(false);
  });
  it('compares state without accepting prefixes', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abcd')).toBe(false);
    expect(safeEqual('abc', 'abd')).toBe(false);
  });
});
