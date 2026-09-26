import { describe, it, expect } from 'vitest';
import {
  slugSchema,
  profileSchema,
  publicIdentity,
} from '../src/domain/profile';
import {
  filterSchema,
  collectionWhere,
  collectionOrder,
  PAGE_SIZE,
} from '../src/domain/collection';
import { resolveAsset, squigArtwork } from '../src/domain/assets';
import { canRefresh, REFRESH_INTERVAL_MS } from '../src/server/refresh';
import snapshot from '../data/squigs.json';
describe('profile privacy and editing', () => {
  const profile = {
    slug: 'alice',
    displayName: 'Alice',
    bio: 'Hello',
    avatar: null,
    showWallets: false,
    showDiscord: false,
    wallets: [{ walletAddress: 'secret-wallet' }],
    identities: [{ username: 'secret-discord' }],
    nonce: 'NEVER_PUBLIC',
    evidence: { secret: true },
  };
  it('explicit DTO excludes hidden identities and unlisted private fields', () => {
    const p = publicIdentity(profile);
    expect(p.wallets).toEqual([]);
    expect(p.discord).toEqual([]);
    expect(JSON.stringify(p)).not.toMatch(/secret|nonce|evidence|NEVER_PUBLIC/);
  });
  it('only opt-in identifiers are shared', () => {
    expect(
      publicIdentity({ ...profile, showWallets: true, showDiscord: true }),
    ).toMatchObject({
      wallets: ['secret-wallet'],
      discord: ['secret-discord'],
    });
  });
  it('normalizes usernames without changing identity', () =>
    expect(slugSchema.parse(' Alice-Squigs ')).toBe('alice-squigs'));
  it.each([
    'admin',
    'API',
    'me',
    'settings',
    'connect',
    'explore',
    'profile',
    'squigs',
    'a',
    'a'.repeat(49),
    '../secret',
    'hello_world',
    '-hello',
    'hello--world',
    'hello-',
  ])('rejects unsafe/reserved slug %s', (s) =>
    expect(slugSchema.safeParse(s).success).toBe(false),
  );
  it('rejects active content avatars and excessive featured tokens', () => {
    const base = {
      slug: 'alice',
      displayName: 'Alice',
      bio: '',
      avatar: 'javascript:alert(1)',
      isPublic: false,
      showWallets: false,
      showDiscord: false,
      featuredTokenIds: [],
    };
    expect(profileSchema.safeParse(base).success).toBe(false);
    expect(
      profileSchema.safeParse({
        ...base,
        avatar: '',
        featuredTokenIds: [1, 2, 3, 4, 5, 6, 7],
      }).success,
    ).toBe(false);
  });
});
describe('collection boundaries', () => {
  it('bounds pagination and ignores malformed filters', () => {
    expect(
      filterSchema.parse({ page: -1, sort: 'SQL', q: '1 OR 1=1' }),
    ).toMatchObject({ page: 1, sort: 'token', q: '' });
    expect(PAGE_SIZE).toBe(24);
  });
  it('empty point bounds are absent instead of zero', () =>
    expect(filterSchema.parse({ min: '', max: '' })).toMatchObject({
      min: undefined,
      max: undefined,
    }));
  it('combines trait type and value in one relation predicate', () => {
    expect(
      collectionWhere(
        filterSchema.parse({
          trait: 'Skin',
          value: 'Green',
          og: '1',
          legendary: '1',
          min: '100',
          max: '800',
        }),
      ),
    ).toMatchObject({
      traits: { some: { traitType: 'Skin', value: 'Green' } },
      og: true,
      legendary: true,
      uglyPoints: { gte: 100, lte: 800 },
    });
  });
  it.each([
    'points-desc',
    'points-asc',
    'rank',
    'og',
    'legendary',
    'token',
  ] as const)('sort %s has stable token tie breaker', (sort) =>
    expect(collectionOrder(sort).at(-1)).toEqual({ tokenId: 'asc' }),
  );
  it('throttles ten-minute refresh window including clock skew', () => {
    const now = new Date();
    expect(canRefresh(null, now)).toBe(true);
    expect(canRefresh(now, now)).toBe(false);
    expect(canRefresh(new Date(now.getTime() - REFRESH_INTERVAL_MS), now)).toBe(
      true,
    );
    expect(canRefresh(new Date(now.getTime() + 1000), now)).toBe(false);
  });
});
describe('artwork and canonical classification', () => {
  it('resolves immutable IPFS artwork with centralized gateway', () =>
    expect(resolveAsset(squigArtwork(3157))).toBe(
      'https://gateway.pinata.cloud/ipfs/QmTVMmCGAYyRZ7QhdR6khzv4yvJwoVvtuc2Uq5eRuUVoFQ/3157',
    ));
  it.each([
    'javascript:alert(1)',
    'data:image/svg+xml,hi',
    'http://example.com/a',
    'https://user:password@example.com',
    'ipfs://CID/../secret',
  ])('rejects unsafe asset %s', (s) => expect(resolveAsset(s)).toBeNull());
  it('supports HTTPS and unavailable images', () => {
    expect(resolveAsset('https://example.com/a.png')).toBe(
      'https://example.com/a.png',
    );
    expect(resolveAsset(null)).toBeNull();
  });
  it('known OG ordinary Squig #1 uses source points/rank', () =>
    expect(snapshot.records[0]).toMatchObject({
      og: true,
      legendary: false,
      uglyPoints: 805,
      mawRank: 303,
      rarityTier: 'epic',
    }));
  it('known Legendary #69 uses ecosystem shared rank', () =>
    expect(snapshot.records[68]).toMatchObject({
      legendary: true,
      uglyPoints: 1200,
      mawRank: 1,
      rarityTier: 'legendary',
    }));
  it('non-OG is based on source Status', () => {
    const s =
      snapshot.records.find((r) => r.traits.Status === 'Squig') ??
      snapshot.records.find((r) => !r.og)!;
    expect(s.og).toBe(false);
    expect(s.traits.Status).not.toBe('OG');
  });
});
