import { describe, it, expect } from 'vitest';
import {
  publicIdentity,
  hasCollectorUsername,
  profileSchema,
} from '../src/domain/profile';
const address = '0x' + 'a'.repeat(40);
const base = {
  slug: 'holder-00000000-0000-0000-0000-000000000001',
  displayName: 'Private alias',
  bio: null,
  avatar: null,
  showWallets: true,
  showDiscord: true,
  showUsername: false,
  claimedAt: null,
  wallets: [],
  discoveredWallets: [{ walletAddress: address }],
  identities: [],
};
describe('public collector identity', () => {
  it('discovery shows a shortened name and inspectable public address', () => {
    const result = publicIdentity(base);
    expect(result.displayName).toBe('0xaaaa…aaaa');
    expect(result.wallets).toEqual([address]);
    expect(result.unclaimed).toBe(true);
  });
  it('uses primary wallet rather than input order', () => {
    expect(
      publicIdentity({
        ...base,
        claimedAt: new Date(),
        wallets: [
          { walletAddress: address },
          { walletAddress: '0x1234567890', isPrimary: true },
        ],
      }).displayName,
    ).toBe('0x1234…7890');
  });
  it('username display requires opt-in', () => {
    expect(publicIdentity({ ...base, showUsername: true }).displayName).toBe(
      'Private alias',
    );
    expect(publicIdentity(base).displayName).not.toBe('Private alias');
  });
  it('never serializes provider IDs, tokens, metadata or evidence', () => {
    const input = {
      ...base,
      discordId: 'private-discord-id',
      dripId: 'private-drip-id',
      token: 'private-token',
      metadata: { secret: 'private-evidence' },
      identities: [
        {
          username: 'friendly',
          externalId: 'private-discord-id',
          metadata: { secret: 'private-evidence' },
        },
      ],
    };
    const output = JSON.stringify(publicIdentity(input));
    for (const marker of [
      'private-discord-id',
      'private-drip-id',
      'private-token',
      'private-evidence',
      'externalId',
      'discordId',
      'dripId',
      'metadata',
    ])
      expect(output).not.toContain(marker);
  });
  it('preserves existing hidden cross-wallet associations', () => {
    expect(publicIdentity({ ...base, showWallets: false }).wallets).toEqual([]);
    expect(publicIdentity({ ...base, showWallets: false }).displayName).toBe(
      'Collector',
    );
  });
  it('does not treat generated slugs as chosen usernames', () => {
    expect(hasCollectorUsername(base.slug)).toBe(false);
    expect(
      hasCollectorUsername('collector-00000000-0000-0000-0000-000000000001'),
    ).toBe(false);
    expect(hasCollectorUsername('ugly-collector')).toBe(true);
  });
  it('allows single-wallet settings without a chosen username', () => {
    expect(
      profileSchema.parse({
        slug: '',
        displayName: '',
        bio: '',
        avatar: '',
        isPublic: true,
        showWallets: true,
        showDiscord: false,
        featuredTokenIds: [],
      }).slug,
    ).toBe('');
  });
});
