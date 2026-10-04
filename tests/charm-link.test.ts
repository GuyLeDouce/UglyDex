import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  externalIdentity: vi.fn(),
  collectorWallet: vi.fn(),
  sourceMappings: vi.fn(),
  dripRead: vi.fn(),
  searchMembersByDripId: vi.fn(),
  identityUpsert: vi.fn(),
  balanceUpsert: vi.fn(),
  priorIdentity: vi.fn(),
  duplicateIdentity: vi.fn(),
  txExternalIdentity: vi.fn(),
  txCollectorWallet: vi.fn(),
  executeRaw: vi.fn(),
}));

const tx = {
  $executeRaw: mocks.executeRaw,
  dripIdentity: {
    findUnique: vi
      .fn()
      .mockImplementation(
        (args: { where: { realmId_collectorId?: unknown } }) =>
          args.where.realmId_collectorId
            ? mocks.priorIdentity()
            : mocks.duplicateIdentity(),
      ),
    upsert: mocks.identityUpsert,
  },
  charmBalance: { upsert: mocks.balanceUpsert },
  externalIdentity: { findMany: mocks.txExternalIdentity },
  collectorWallet: { findMany: mocks.txCollectorWallet },
};

vi.mock('@/server/db', () => ({
  db: () => ({
    externalIdentity: { findMany: mocks.externalIdentity },
    collectorWallet: { findMany: mocks.collectorWallet },
    $transaction: (run: (value: typeof tx) => unknown) => run(tx),
  }),
}));
vi.mock('@/server/drip-sync', () => ({
  dripConfig: () => ({
    DRIP_REALM_ID: 'a'.repeat(24),
    DRIP_REALM_POINT_ID: 'b'.repeat(24),
  }),
  dripRead: mocks.dripRead,
}));
vi.mock('@/integrations/wallet-links', () => ({
  getDripMemberMappings: mocks.sourceMappings,
}));

import { verifyAndLinkDripMember } from '@/server/charm-link';

const collectorId = 'collector-fixture';
const memberId = 'c'.repeat(24);
const otherMemberId = 'd'.repeat(24);
const discordId = '123456789012345678';
const walletAddress = '0x1111111111111111111111111111111111111111';
const currencyId = 'b'.repeat(24);

function upstreamMember(overrides: Record<string, unknown> = {}) {
  return {
    id: memberId,
    realmMemberId: 'private-realm-member-fixture',
    credentials: [{ oauthProvider: 'discord', oauthAccountId: discordId }],
    balances: [{ currencyId, balance: '9007199254740993.123456789' }],
    ...overrides,
  };
}

function prepare(member = upstreamMember()) {
  mocks.externalIdentity.mockResolvedValue([{ externalId: discordId }]);
  mocks.collectorWallet.mockResolvedValue([{ walletAddress }]);
  mocks.sourceMappings.mockResolvedValue({ ok: true, data: [] });
  mocks.searchMembersByDripId.mockResolvedValue({
    body: { data: [member], meta: { totalPages: 1 } },
    rate: null,
  });
  mocks.dripRead.mockImplementation((run) =>
    run({ searchMembersByDripId: mocks.searchMembersByDripId }),
  );
  mocks.priorIdentity.mockResolvedValue(null);
  mocks.duplicateIdentity.mockResolvedValue(null);
  mocks.txExternalIdentity.mockResolvedValue([{ externalId: discordId }]);
  mocks.txCollectorWallet.mockResolvedValue([{ walletAddress }]);
  mocks.identityUpsert.mockResolvedValue({ id: 'private-identity-fixture' });
  mocks.balanceUpsert.mockResolvedValue({});
}

beforeEach(() => {
  vi.clearAllMocks();
  prepare();
});

describe('verifyAndLinkDripMember', () => {
  it('accepts the exact 24-hex DRIP ID shape and performs only the exact GET lookup', async () => {
    await expect(
      verifyAndLinkDripMember(collectorId, memberId),
    ).resolves.toEqual({ balanceAvailable: true });
    expect(mocks.searchMembersByDripId).toHaveBeenCalledWith([memberId]);
    expect(mocks.dripRead).toHaveBeenCalledOnce();
    expect(mocks.identityUpsert).toHaveBeenCalledOnce();
    expect(mocks.balanceUpsert).toHaveBeenCalledOnce();
  });

  it('rejects malformed IDs before a DRIP request or persistence', async () => {
    await expect(
      verifyAndLinkDripMember(collectorId, 'not-a-drip-id'),
    ).rejects.toThrow();
    expect(mocks.dripRead).not.toHaveBeenCalled();
    expect(mocks.identityUpsert).not.toHaveBeenCalled();
    expect(mocks.balanceUpsert).not.toHaveBeenCalled();
  });

  it('allows the exact wallet_links Discord and active-wallet mapping', async () => {
    mocks.sourceMappings.mockResolvedValue({
      ok: true,
      data: [{ discordId, walletAddress, dripMemberId: memberId }],
    });
    prepare(upstreamMember());
    mocks.sourceMappings.mockResolvedValue({
      ok: true,
      data: [{ discordId, walletAddress, dripMemberId: memberId }],
    });

    await verifyAndLinkDripMember(collectorId, memberId);

    expect(mocks.identityUpsert.mock.calls[0][0].create.source).toBe(
      'VERIFIED_WALLET_LINK',
    );
  });

  it('rejects a wallet_links mapping to another submitted member', async () => {
    mocks.sourceMappings.mockResolvedValue({
      ok: true,
      data: [{ discordId, walletAddress, dripMemberId: otherMemberId }],
    });
    await expect(
      verifyAndLinkDripMember(collectorId, memberId),
    ).rejects.toThrow('DRIP_MEMBER_IDENTITY_UNVERIFIED');
    expect(mocks.dripRead).not.toHaveBeenCalled();
    expectNoIdentityWrites();
  });

  it('rejects multiple conflicting wallet_links DRIP IDs', async () => {
    mocks.sourceMappings.mockResolvedValue({
      ok: true,
      data: [
        { discordId, walletAddress, dripMemberId: memberId },
        { discordId, walletAddress, dripMemberId: otherMemberId },
      ],
    });
    await expect(
      verifyAndLinkDripMember(collectorId, memberId),
    ).rejects.toThrow('DRIP_MEMBER_IDENTITY_UNVERIFIED');
    expectNoIdentityWrites();
  });

  it('allows a matching authenticated Discord credential', async () => {
    prepare(
      upstreamMember({
        credentials: [{ oauthProvider: 'discord', oauthAccountId: discordId }],
      }),
    );
    await verifyAndLinkDripMember(collectorId, memberId);
    expect(mocks.identityUpsert.mock.calls[0][0].create.source).toBe(
      'EXACT_DRIP_CREDENTIAL',
    );
  });

  it('allows a matching active verified wallet credential', async () => {
    prepare(
      upstreamMember({
        credentials: [{ format: 'wallet', publicIdentifier: walletAddress }],
      }),
    );
    await verifyAndLinkDripMember(collectorId, memberId);
    expect(mocks.identityUpsert.mock.calls[0][0].create.source).toBe(
      'EXACT_DRIP_CREDENTIAL',
    );
  });

  it('rejects missing ownership proof and writes nothing', async () => {
    prepare(upstreamMember({ credentials: [] }));
    await expect(
      verifyAndLinkDripMember(collectorId, memberId),
    ).rejects.toThrow('DRIP_MEMBER_IDENTITY_UNVERIFIED');
    expectNoIdentityWrites();
  });

  it('rejects a DRIP member already owned by another Collector', async () => {
    mocks.duplicateIdentity.mockResolvedValue({
      collectorId: 'another-collector',
      status: 'RESOLVED',
    });
    prepare(
      upstreamMember({
        credentials: [{ oauthProvider: 'discord', oauthAccountId: discordId }],
      }),
    );
    mocks.duplicateIdentity.mockResolvedValue({
      collectorId: 'another-collector',
      status: 'RESOLVED',
    });
    await expect(
      verifyAndLinkDripMember(collectorId, memberId),
    ).rejects.toThrow('DRIP_MEMBER_IDENTITY_UNVERIFIED');
    expectNoIdentityWrites();
  });

  it('rejects a Collector already linked to a different member', async () => {
    prepare(
      upstreamMember({
        credentials: [{ oauthProvider: 'discord', oauthAccountId: discordId }],
      }),
    );
    mocks.priorIdentity.mockResolvedValue({
      status: 'RESOLVED',
      dripMemberId: otherMemberId,
    });
    await expect(
      verifyAndLinkDripMember(collectorId, memberId),
    ).rejects.toThrow('DRIP_MEMBER_IDENTITY_UNVERIFIED');
    expectNoIdentityWrites();
  });

  it('rejects a prior CONFLICT state', async () => {
    prepare(
      upstreamMember({
        credentials: [{ oauthProvider: 'discord', oauthAccountId: discordId }],
      }),
    );
    mocks.priorIdentity.mockResolvedValue({
      status: 'CONFLICT',
      dripMemberId: memberId,
    });
    await expect(
      verifyAndLinkDripMember(collectorId, memberId),
    ).rejects.toThrow('DRIP_MEMBER_IDENTITY_UNVERIFIED');
    expectNoIdentityWrites();
  });

  it.each([
    ['no members', { data: [], meta: { totalPages: 0 } }],
    [
      'multiple members',
      { data: [upstreamMember(), upstreamMember({ id: otherMemberId })] },
    ],
    ['multiple pages', { data: [upstreamMember()], meta: { totalPages: 2 } }],
    ['wrong returned ID', { data: [upstreamMember({ id: otherMemberId })] }],
  ])('rejects DRIP search response with %s', async (_label, body) => {
    mocks.searchMembersByDripId.mockResolvedValue({ body, rate: null });
    await expect(
      verifyAndLinkDripMember(collectorId, memberId),
    ).rejects.toThrow('DRIP_MEMBER_IDENTITY_UNVERIFIED');
    expectNoIdentityWrites();
  });

  it('rejects multiple configured $CHARM balances without persistence', async () => {
    prepare(
      upstreamMember({
        credentials: [{ oauthProvider: 'discord', oauthAccountId: discordId }],
        balances: [
          { currencyId, balance: '1' },
          { currencyId, balance: '2' },
        ],
      }),
    );
    await expect(
      verifyAndLinkDripMember(collectorId, memberId),
    ).rejects.toThrow('DRIP_MEMBER_IDENTITY_UNVERIFIED');
    expectNoIdentityWrites();
  });

  it('saves an exact decimal current balance without floating-point conversion', async () => {
    const exact = '9007199254740993.123456789';
    prepare(
      upstreamMember({
        credentials: [{ oauthProvider: 'discord', oauthAccountId: discordId }],
        balances: [{ currencyId, balance: exact }],
      }),
    );
    await verifyAndLinkDripMember(collectorId, memberId);
    const saved = mocks.balanceUpsert.mock.calls[0][0];
    expect(saved.create.balance.toString()).toBe(exact);
    expect(saved.create.status).toBe('CURRENT');
    expect(saved.create.observedAt).toBeInstanceOf(Date);
  });

  it('saves a verified identity but keeps a missing $CHARM balance UNKNOWN', async () => {
    prepare(
      upstreamMember({
        credentials: [{ oauthProvider: 'discord', oauthAccountId: discordId }],
        balances: [{ currencyId: 'e'.repeat(24), balance: '99' }],
      }),
    );
    await expect(
      verifyAndLinkDripMember(collectorId, memberId),
    ).resolves.toEqual({ balanceAvailable: false });
    expect(mocks.identityUpsert).toHaveBeenCalledOnce();
    expect(mocks.balanceUpsert.mock.calls[0][0].create).toMatchObject({
      balance: null,
      observedAt: null,
      status: 'UNKNOWN',
    });
  });

  it('does not turn DRIP access=false into an identity or balance', async () => {
    mocks.searchMembersByDripId.mockResolvedValue({
      body: {
        data: [
          upstreamMember({
            credentials: [
              { oauthProvider: 'discord', oauthAccountId: discordId },
            ],
          }),
        ],
        meta: { credentials: { access: false } },
      },
      rate: null,
    });
    await expect(
      verifyAndLinkDripMember(collectorId, memberId),
    ).rejects.toThrow('DRIP_MEMBER_IDENTITY_UNVERIFIED');
    expectNoIdentityWrites();
  });

  it('never sends private identity or balance fields to the caller', async () => {
    const result = await verifyAndLinkDripMember(collectorId, memberId);
    expect(JSON.stringify(result)).not.toMatch(
      /dripMemberId|realmMemberId|wallet|discord|9007199254740993/i,
    );
    expect(Object.keys(result).sort()).toEqual(['balanceAvailable']);
  });
});

function expectNoIdentityWrites() {
  expect(mocks.identityUpsert).not.toHaveBeenCalled();
  expect(mocks.balanceUpsert).not.toHaveBeenCalled();
}
