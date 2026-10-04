import { describe, expect, it, vi } from 'vitest';
import {
  DripReader,
  validateCurrency,
  exactMembers,
  parseDripJson,
  rateHeaders,
} from '../src/integrations/drip';
const realm = 'a'.repeat(24),
  currency = 'b'.repeat(24),
  discord = '123456789012345678';
const member = {
  id: 'c'.repeat(24),
  credentials: [{ oauthProvider: 'discord', oauthAccountId: discord }],
  balances: [{ currencyId: currency, balance: '123.45' }],
};
describe('DRIP read-only authoritative integration', () => {
  it('sanitizes streamed upstream errors that contain private credentials', async () => {
    const response = new Response(
      new ReadableStream({
        start(controller) {
          controller.error(
            new Error('Bearer fixture-private-key; fixture-member-identity'),
          );
        },
      }),
    );
    const client = new DripReader(
      { key: 'fixture-private-key', realm },
      vi.fn().mockResolvedValue(response),
    );
    await expect(client.getRealm()).rejects.toThrow('DRIP_RESPONSE_READ');
  });
  it('never logs upstream response bodies or Authorization credentials', async () => {
    const logs = [
      vi.spyOn(console, 'log').mockImplementation(() => {}),
      vi.spyOn(console, 'warn').mockImplementation(() => {}),
      vi.spyOn(console, 'error').mockImplementation(() => {}),
    ];
    try {
      const client = new DripReader(
        { key: 'fixture-private-key', realm },
        vi
          .fn()
          .mockResolvedValue(
            new Response(
              'Bearer fixture-private-key; fixture-member-identity',
              { status: 500 },
            ),
          ),
      );
      await expect(client.getRealm()).rejects.toThrow('DRIP_HTTP_500');
      for (const log of logs) expect(log).not.toHaveBeenCalled();
    } finally {
      for (const log of logs) log.mockRestore();
    }
  });
  it('uses the current base, Bearer and fixed GET operations only', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('{}'));
    const client = new DripReader({ key: 'private-test-key', realm }, fetcher);
    await client.getRealm();
    expect(fetcher.mock.calls[0][0].toString()).toBe(
      'https://api.drip.re/api/v1/realms/' + realm,
    );
    expect(fetcher.mock.calls[0][1]).toMatchObject({
      method: 'GET',
      headers: { Authorization: 'Bearer private-test-key' },
      redirect: 'error',
    });
    expect(Object.getOwnPropertyNames(DripReader.prototype).sort()).toEqual(
      [
        'constructor',
        'getCurrencies',
        'getRealm',
        'searchMembers',
        'searchMembersByDripId',
      ].sort(),
    );
  });
  it('requires exact IDs, rejects usernames and batches above the code-owned ceiling', async () => {
    const client = new DripReader({ key: 'test', realm }, vi.fn());
    await expect(client.searchMembers(['username'])).rejects.toThrow();
    await expect(
      client.searchMembers(
        Array.from({ length: 26 }, (_, i) =>
          String(123456789012345678n + BigInt(i)),
        ),
      ),
    ).rejects.toThrow();
  });
  it('constructs exact discord-id search', async () => {
    const f = vi.fn().mockResolvedValue(new Response('{}'));
    await new DripReader({ key: 'test', realm }, f).searchMembers([discord]);
    const url = new URL(f.mock.calls[0][0]);
    expect(url.pathname).toBe(`/api/v1/realms/${realm}/members/search`);
    expect(url.searchParams.get('type')).toBe('discord-id');
    expect(url.searchParams.get('values')).toBe(discord);
  });
  it('constructs exact mapped drip-id search', async () => {
    const f = vi.fn().mockResolvedValue(new Response('{}'));
    const dripId = 'd'.repeat(24);
    await new DripReader({ key: 'test', realm }, f).searchMembersByDripId([
      dripId,
    ]);
    const url = new URL(f.mock.calls[0][0]);
    expect(url.pathname).toBe(`/api/v1/realms/${realm}/members/search`);
    expect(url.searchParams.get('type')).toBe('drip-id');
    expect(url.searchParams.get('values')).toBe(dripId);
  });
  it('accepts an owned currency at the exact realm endpoint', () =>
    expect(
      validateCurrency(
        { id: currency, ownership: 'OWNED', archived: false },
        realm,
        currency,
      ),
    ).toBe(true));
  it.each([
    { id: 'wrong', archived: false },
    { id: currency, realmId: 'wrong', archived: false },
    { id: currency, realmId: realm, archived: true },
    { id: currency, realmId: realm, archived: false, archivedAt: '2020-01-01' },
    { id: currency, archived: false },
  ])('rejects invalid currency association or archive state', (row) =>
    expect(validateCurrency(row, realm, currency)).toBe(false),
  );
  it('resolves only exact Discord credentials', () =>
    expect(exactMembers([member], [discord], currency)[0]).toMatchObject({
      discordId: discord,
      status: 'RESOLVED',
      balance: '123.45',
    }));
  it('never falls back to username', () =>
    expect(
      exactMembers(
        [{ ...member, credentials: [], username: discord }],
        [discord],
        currency,
      )[0].status,
    ).toBe('UNRESOLVED'));
  it('does not guess duplicate identity matches', () =>
    expect(
      exactMembers(
        [member, { ...member, id: 'd'.repeat(24) }],
        [discord],
        currency,
      )[0].status,
    ).toBe('CONFLICT'));
  it('unknown balance is not zero', () =>
    expect(
      exactMembers([{ ...member, balances: [] }], [discord], currency)[0]
        .balance,
    ).toBeNull());
  it('preserves large decimal balance JSON lexemes exactly', () =>
    expect(parseDripJson('{"balance":9007199254740993.123456789}')).toEqual({
      balance: '9007199254740993.123456789',
    }));
  it('honors shared rate-limit headers and Retry-After', () =>
    expect(
      rateHeaders(
        new Headers({
          'X-RateLimit-Limit': '24',
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': '100',
          'X-RateLimit-Window': '60',
          'Retry-After': '120',
        }),
        0,
      ),
    ).toEqual({
      limit: 24,
      remaining: 0,
      resetAt: 100000,
      window: 60,
      retryAt: 120000,
    }));
  it('redacts remote errors and never follows redirects', async () => {
    const f = vi
      .fn()
      .mockResolvedValue(
        new Response('private identity and key', { status: 403 }),
      );
    await expect(
      new DripReader({ key: 'test', realm }, f).getRealm(),
    ).rejects.toThrow('DRIP_HTTP_403');
  });
});
