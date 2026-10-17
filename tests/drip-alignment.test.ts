import { describe, expect, it, vi } from 'vitest';
import { DripReadError, type DripResponse } from '../src/integrations/drip';
import { proveDripAlignment } from '../src/server/drip-alignment';

const realm = 'a'.repeat(24);
const currency = 'b'.repeat(24);
const memberId = 'c'.repeat(24);
const balance = '12345678901234567890.123456789012345678';
const bots = {
  uglyBotRealm: realm,
  uglyBotCurrency: currency,
  gauntletRealm: realm,
  gauntletCurrency: currency,
};
const ok = (body: unknown): DripResponse => ({
  body,
  rate: {
    limit: null,
    remaining: null,
    resetAt: null,
    window: null,
    retryAt: null,
  },
});
function setup() {
  const api = {
    getRealm: vi.fn().mockResolvedValue(ok({ id: realm })),
    getCurrencies: vi
      .fn()
      .mockResolvedValue(
        ok({ data: [{ id: currency, realmId: realm, archived: false }] }),
      ),
    findResolvedDripMemberId: vi.fn().mockResolvedValue(memberId),
    searchMembersByDripId: vi.fn().mockResolvedValue(
      ok({
        data: [
          {
            id: memberId,
            balances: [{ currencyId: currency, balance }],
          },
        ],
        meta: { totalPages: 1 },
      }),
    ),
    waitAfterRealm: vi.fn().mockResolvedValue(undefined),
    waitBeforeFallback: vi.fn().mockResolvedValue(undefined),
  };
  return api;
}

describe('DRIP alignment proof modes', () => {
  it('uses the validated current currency catalog when available', async () => {
    const api = setup();
    const evidence = await proveDripAlignment(bots, { realm, currency }, api);

    expect(evidence).toMatchObject({
      uglyBotRealm: true,
      uglyBotCurrency: true,
      gauntletRealm: true,
      gauntletCurrency: true,
      currencyProof: 'CURRENCY_CATALOG',
      currencyCatalogAccess: 'AVAILABLE',
      currencyActive: true,
      readOnly: true,
    });
    expect(api.searchMembersByDripId).not.toHaveBeenCalled();
    expect(api.findResolvedDripMemberId).not.toHaveBeenCalled();
  });

  it('uses a fresh exact resolved member balance only after catalog HTTP 403', async () => {
    const api = setup();
    api.getCurrencies.mockRejectedValue(
      new DripReadError('DRIP_HTTP_403', null),
    );

    const evidence = await proveDripAlignment(bots, { realm, currency }, api);

    expect(api.findResolvedDripMemberId).toHaveBeenCalledOnce();
    expect(api.searchMembersByDripId).toHaveBeenCalledWith([memberId]);
    expect(api.waitBeforeFallback).toHaveBeenCalledOnce();
    expect(evidence).toMatchObject({
      currencyProof: 'EXACT_MEMBER_BALANCE',
      currencyObservedInLiveMember: true,
      currencyCatalogAccess: 'FORBIDDEN',
      readOnly: true,
    });
    expect(evidence).not.toHaveProperty('currencyActive');
    expect(JSON.stringify(evidence)).not.toContain(memberId);
    expect(JSON.stringify(evidence)).not.toContain(balance);
  });

  it('does not fall back when no resolved member is available', async () => {
    const api = setup();
    api.getCurrencies.mockRejectedValue(
      new DripReadError('DRIP_HTTP_403', null),
    );
    api.findResolvedDripMemberId.mockResolvedValue(null);

    await expect(
      proveDripAlignment(bots, { realm, currency }, api),
    ).rejects.toThrow('DRIP_ALIGNMENT_MEMBER_PROOF_FAILED');
    expect(api.searchMembersByDripId).not.toHaveBeenCalled();
  });

  it('does not align when the exact member has no configured currency balance', async () => {
    const api = setup();
    api.getCurrencies.mockRejectedValue(
      new DripReadError('DRIP_HTTP_403', null),
    );
    api.searchMembersByDripId.mockResolvedValue(
      ok({ data: [{ id: memberId, balances: [] }], meta: { totalPages: 1 } }),
    );

    await expect(
      proveDripAlignment(bots, { realm, currency }, api),
    ).rejects.toThrow('DRIP_ALIGNMENT_MEMBER_PROOF_FAILED');
  });

  it('rejects duplicate configured currency balance entries', async () => {
    const api = setup();
    api.getCurrencies.mockRejectedValue(
      new DripReadError('DRIP_HTTP_403', null),
    );
    api.searchMembersByDripId.mockResolvedValue(
      ok({
        data: [
          {
            id: memberId,
            balances: [
              { currencyId: currency, balance: '1' },
              { currencyId: currency, balance: '2' },
            ],
          },
        ],
        meta: { totalPages: 1 },
      }),
    );

    await expect(
      proveDripAlignment(bots, { realm, currency }, api),
    ).rejects.toThrow('DRIP_ALIGNMENT_MEMBER_PROOF_FAILED');
  });

  it.each(['DRIP_HTTP_401', 'DRIP_HTTP_429'])(
    'does not use member fallback for %s',
    async (status) => {
      const api = setup();
      api.getCurrencies.mockRejectedValue(new DripReadError(status, null));

      await expect(
        proveDripAlignment(bots, { realm, currency }, api),
      ).rejects.toThrow(status);
      expect(api.findResolvedDripMemberId).not.toHaveBeenCalled();
      expect(api.searchMembersByDripId).not.toHaveBeenCalled();
    },
  );

  it('does not use member fallback for malformed catalog responses', async () => {
    const api = setup();
    api.getCurrencies.mockResolvedValue(ok({ data: 'not-an-array' }));

    await expect(
      proveDripAlignment(bots, { realm, currency }, api),
    ).rejects.toThrow();
    expect(api.findResolvedDripMemberId).not.toHaveBeenCalled();
  });

  it('rejects a wrong returned realm before reading currencies', async () => {
    const api = setup();
    api.getRealm.mockResolvedValue(ok({ id: 'd'.repeat(24) }));

    await expect(
      proveDripAlignment(bots, { realm, currency }, api),
    ).rejects.toThrow('CHARM_ECONOMY_MISMATCH');
    expect(api.getCurrencies).not.toHaveBeenCalled();
  });

  it.each([
    ['UglyBot', { ...bots, uglyBotRealm: 'd'.repeat(24) }],
    ['UglyBot', { ...bots, uglyBotCurrency: 'd'.repeat(24) }],
    ['Gauntlet', { ...bots, gauntletRealm: 'd'.repeat(24) }],
    ['Gauntlet', { ...bots, gauntletCurrency: 'd'.repeat(24) }],
  ])('rejects %s configuration mismatch', async (_name, suppliedBots) => {
    const api = setup();

    await expect(
      proveDripAlignment(suppliedBots, { realm, currency }, api),
    ).rejects.toThrow('CHARM_ECONOMY_MISMATCH');
    expect(api.getRealm).not.toHaveBeenCalled();
  });

  it.each([
    ['no member', { data: [], meta: { totalPages: 0 } }],
    ['different member', { data: [{ id: 'd'.repeat(24), balances: [] }] }],
    [
      'duplicate response members',
      {
        data: [
          { id: memberId, balances: [{ currencyId: currency, balance: '1' }] },
          { id: memberId, balances: [{ currencyId: currency, balance: '1' }] },
        ],
      },
    ],
    [
      'ambiguous pagination',
      {
        data: [
          { id: memberId, balances: [{ currencyId: currency, balance: '1' }] },
        ],
        meta: { totalPages: 2 },
      },
    ],
    [
      'invalid balance',
      {
        data: [
          {
            id: memberId,
            balances: [{ currencyId: currency, balance: 'not-decimal' }],
          },
        ],
      },
    ],
  ])('rejects %s from exact member evidence', async (_label, body) => {
    const api = setup();
    api.getCurrencies.mockRejectedValue(
      new DripReadError('DRIP_HTTP_403', null),
    );
    api.searchMembersByDripId.mockResolvedValue(ok(body));

    await expect(
      proveDripAlignment(bots, { realm, currency }, api),
    ).rejects.toThrow('DRIP_ALIGNMENT_MEMBER_PROOF_FAILED');
  });

  it('makes only the fixed GET reads needed for the selected proof mode', async () => {
    const api = setup();
    api.getCurrencies.mockRejectedValue(
      new DripReadError('DRIP_HTTP_403', null),
    );

    await proveDripAlignment(bots, { realm, currency }, api);

    expect(
      Object.keys(api).filter((method) =>
        /post|put|patch|delete/i.test(method),
      ),
    ).toEqual([]);
    expect(api.getRealm).toHaveBeenCalledOnce();
    expect(api.getCurrencies).toHaveBeenCalledOnce();
    expect(api.searchMembersByDripId).toHaveBeenCalledOnce();
  });
});
