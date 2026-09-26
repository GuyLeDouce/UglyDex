import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import {
  artworkUri,
  collectibleImageUrl,
  customSchema,
  editionSchema,
  collectibleManifest,
} from '../src/domain/collectibles';
import { inspectCollectibleArtwork } from '../src/server/collectible-art';
import {
  workerControlSchema,
  heartbeatState,
  safeOperationalCode,
} from '../src/domain/operations';
import {
  cosmeticCatalog,
  resolveAppearance,
  appearanceSchema,
} from '../src/domain/cosmetics';
const uri = 'ipfs://QmTVMmCGAYyRZ7QhdR6khzv4yvJwoVvtuc2Uq5eRuUVoFQ/1';
const base = {
  name: 'Official test',
  imageUri: uri,
  source: 'Reviewed manifest',
  sourceReference: 'TEST-001',
};
describe('official collectible input boundaries', () => {
  it('defaults Customs to private drafts', () =>
    expect(
      customSchema.parse({ ...base, key: 'test-custom', tokenId: 1 }).status,
    ).toBe('DRAFT'));
  for (const patch of [
    { tokenId: 0 },
    { tokenId: 4445 },
    { key: 'admin' },
    { name: '' },
    { status: 'PUBLIC' },
    { artist: 'x'.repeat(101) },
    { description: 'x'.repeat(1001) },
    { issuedAt: 'yesterday' },
    { sourceReference: '' },
    { imageUri: 'https://evil.invalid/x' },
    { html: '<script>' },
  ])
    it('rejects invalid Custom ' + JSON.stringify(patch).slice(0, 50), () =>
      expect(
        customSchema.safeParse({
          ...base,
          key: 'test-custom',
          tokenId: 1,
          ...patch,
        }).success,
      ).toBe(false),
    );
  it('catalog-only Edition has no inferred contract', () => {
    const e = editionSchema.parse({ ...base, slug: 'test-edition' });
    expect(e.chainId).toBeNull();
    expect(e.standard).toBe('NONE');
  });
  it('permits explicit multiple character relations', () =>
    expect(
      editionSchema.parse({
        ...base,
        slug: 'test-edition',
        relatedTokens: [1, 2],
      }).relatedTokens,
    ).toEqual([1, 2]));
  for (const patch of [
    { standard: 'ERC721' },
    { standard: 'NONE', chainId: 1 },
    { relatedTokens: [1, 1] },
    { supply: 0 },
    { tokenId: '-1' },
    {
      standard: 'ERC721',
      chainId: 1,
      contractAddress: '0x' + 'a'.repeat(40),
      tokenId: '1',
      supply: 2,
    },
    {
      standard: 'ERC721',
      chainId: 1,
      contractAddress: '0x8c9a02c0585200c4c65608df6b8def543d33792a',
      tokenId: '1',
    },
  ])
    it('rejects invalid Edition ' + JSON.stringify(patch).slice(0, 50), () =>
      expect(
        editionSchema.safeParse({ ...base, slug: 'test-edition', ...patch })
          .success,
      ).toBe(false),
    );
  it('accepts explicit ERC1155 chain identity', () =>
    expect(
      editionSchema.safeParse({
        ...base,
        slug: 'test-edition',
        standard: 'ERC1155',
        chainId: 1,
        contractAddress: '0x' + 'a'.repeat(40),
        tokenId: '42',
        supply: 100,
      }).success,
    ).toBe(true));
  it('rejects oversize manifests', () =>
    expect(
      collectibleManifest.safeParse({
        version: 1,
        kind: 'CUSTOM',
        records: Array.from({ length: 101 }, () => ({
          ...base,
          key: 'test-custom',
          tokenId: 1,
        })),
      }).success,
    ).toBe(false));
});
describe('artwork SSRF and raster decoding', () => {
  it('rejects SVG disguised as PNG before decoding', async () => {
    await expect(
      inspectCollectibleArtwork(
        uri,
        (async () =>
          new Response(
            '<svg xmlns="http://www.w3.org/2000/svg"><image href="http://127.0.0.1/private"/></svg>',
            { headers: { 'Content-Type': 'image/png' } },
          )) as typeof fetch,
      ),
    ).rejects.toThrow('INVALID_ARTWORK_SIGNATURE');
  });
  for (const url of [
    'http://127.0.0.1/a',
    'https://169.254.169.254/a',
    'file:///etc/passwd',
    'data:image/png;base64,AA',
    'ipfs://localhost',
    'ipfs://' + uri.slice(7) + '/../secret',
    uri + '?url=http://localhost',
    uri + '#x',
    uri + '/%2e%2e/x',
    uri + '/a\\b',
    'https://gateway.pinata.cloud@localhost/x',
  ])
    it('rejects ' + url, () =>
      expect(artworkUri.safeParse(url).success).toBe(false),
    );
  it('reconstructs one fixed trusted gateway', () =>
    expect(collectibleImageUrl(uri)).toBe(
      'https://gateway.pinata.cloud/ipfs/' + uri.slice(7),
    ));
  it('decodes PNG and returns bounded provenance', async () => {
    const bytes = await sharp({
      create: { width: 32, height: 32, channels: 3, background: '#334433' },
    })
      .png()
      .toBuffer();
    const fetcher = (async (_u, init) => {
      expect(init?.redirect).toBe('error');
      return new Response(bytes, { headers: { 'Content-Type': 'image/png' } });
    }) as typeof fetch;
    const a = await inspectCollectibleArtwork(uri, fetcher);
    expect(a.width).toBe(32);
    expect(a.sha256).toMatch(/^[a-f0-9]{64}$/);
  });
  for (const mime of ['image/svg+xml', 'text/html', 'application/octet-stream'])
    it('rejects MIME ' + mime, async () => {
      await expect(
        inspectCollectibleArtwork(
          uri,
          (async () =>
            new Response('<svg/>', {
              headers: { 'Content-Type': mime },
            })) as typeof fetch,
        ),
      ).rejects.toThrow();
    });
  it('rejects corrupt PNG', async () =>
    await expect(
      inspectCollectibleArtwork(
        uri,
        (async () =>
          new Response('not PNG', {
            headers: { 'Content-Type': 'image/png' },
          })) as typeof fetch,
      ),
    ).rejects.toThrow());
  it('bounds content length', async () =>
    await expect(
      inspectCollectibleArtwork(
        uri,
        (async () =>
          new Response('', {
            headers: {
              'Content-Type': 'image/png',
              'Content-Length': '3000001',
            },
          })) as typeof fetch,
      ),
    ).rejects.toThrow('INVALID_ARTWORK_RESPONSE'));
  it('bounds decoded dimensions', async () => {
    const bytes = await sharp({
      create: { width: 4097, height: 1, channels: 3, background: '#000' },
    })
      .png()
      .toBuffer();
    await expect(
      inspectCollectibleArtwork(
        uri,
        (async () =>
          new Response(bytes, {
            headers: { 'Content-Type': 'image/png' },
          })) as typeof fetch,
      ),
    ).rejects.toThrow('UNSUPPORTED_ARTWORK');
  });
});
describe('operations and deterministic cosmetics', () => {
  for (const service of [
    'blockchain',
    'ecosystem',
    'progression',
    'collections',
  ])
    it('accepts disabled ' + service, () =>
      expect(
        workerControlSchema.parse({ service, mode: 'DISABLED' }).mode,
      ).toBe('DISABLED'),
    );
  for (const input of [
    { service: 'blockchain', mode: 'true' },
    { service: 'shell', mode: 'LIVE' },
    { service: 'blockchain', mode: 'LIVE', command: 'rm' },
  ])
    it('rejects unsafe worker input ' + JSON.stringify(input), () =>
      expect(workerControlSchema.safeParse(input).success).toBe(false),
    );
  it('marks crashed heartbeats stale', () =>
    expect(heartbeatState(new Date(0), 'RUNNING', new Date(100000))).toBe(
      'STALE',
    ));
  it('redacts unknown operational error text', () =>
    expect(
      safeOperationalCode(new Error('postgres://user:secret@host/db')),
    ).toBe('OPERATION_FAILED'));
  it('falls back after entitlement loss', () =>
    expect(
      resolveAppearance(
        [{ kind: 'CARD_FRAME', cosmeticId: 'frame-legendary' }],
        ['frame-classic'],
      ).frame,
    ).toBe('classic'));
  it('resolves only the selected public safe style', () =>
    expect(
      resolveAppearance(
        [{ kind: 'PROFILE_THEME', cosmeticId: 'theme-labs' }],
        ['theme-labs'],
      ).theme,
    ).toBe('labs'));
  it('rejects arbitrary CSS input', () =>
    expect(
      appearanceSchema.safeParse({ css: 'body{display:none}' }).success,
    ).toBe(false));
  it('has no purchase source', () =>
    expect(
      cosmeticCatalog.every((c) =>
        ['FREE', 'ACHIEVEMENT', 'SET', 'OG', 'LEGENDARY'].includes(c.source),
      ),
    ).toBe(true));
});
