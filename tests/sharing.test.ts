import { describe, it, expect } from 'vitest';
import {
  gallerySchema,
  galleryAccess,
  shareSchema,
  stableShuffle,
  suggestedCopy,
} from '../src/domain/sharing';
import { loadArtwork, trustedArtwork } from '../src/server/share-art';
const valid = { slug: 'my-freaks', name: 'My freaks', items: [{ tokenId: 1 }] };
describe('gallery boundaries', () => {
  it('defaults private and normalizes slug', () => {
    const g = gallerySchema.parse({ ...valid, slug: ' MY-FREAKS ' });
    expect(g.visibility).toBe('PRIVATE');
    expect(g.slug).toBe('my-freaks');
  });
  for (const patch of [
    { slug: 'api' },
    { slug: '../private' },
    { name: '' },
    { items: [{ tokenId: 0 }] },
    { items: [{ tokenId: 4445 }] },
    { items: [{ tokenId: 1 }, { tokenId: 1 }] },
    { coverTokenId: 2 },
    { items: [{ tokenId: 1, caption: 'a'.repeat(181) }] },
    { items: [{ tokenId: 1, section: 'x'.repeat(41) }] },
    { items: Array.from({ length: 101 }, (_, i) => ({ tokenId: i + 1 })) },
  ])
    it('rejects ' + JSON.stringify(patch).slice(0, 60), () =>
      expect(gallerySchema.safeParse({ ...valid, ...patch }).success).toBe(
        false,
      ),
    );
  for (const v of ['PUBLIC', 'UNLISTED', 'PRIVATE'])
    for (const pub of [true, false])
      it('access ' + v + ' ' + pub, () => {
        expect(galleryAccess(pub, v)).toBe(pub && v !== 'PRIVATE');
        expect(galleryAccess(pub, v, true)).toBe(true);
      });
  it('caption stays plain text', () =>
    expect(
      gallerySchema.parse({
        ...valid,
        items: [{ tokenId: 1, caption: '<script>bad()</script>' }],
      }).items[0].caption,
    ).toContain('<script>'));
});
describe('sharing boundaries', () => {
  for (const entity of ['0', 'https://evil.test', '../admin'])
    it('rejects entity ' + entity, () =>
      expect(shareSchema.safeParse({ entity }).success).toBe(false),
    );
  for (const kind of [
    'collector',
    'completion',
    'trophy',
    'collage',
    'squig',
    'passport',
    'achievement',
    'set',
    'gallery',
    'discovery',
    'milestone',
  ])
    it('accepts ' + kind, () =>
      expect(shareSchema.parse({ kind, entity: 'test-collector' }).ratio).toBe(
        'landscape',
      ),
    );
  it('rejects arbitrary image URL', () =>
    expect(
      shareSchema.safeParse({ entity: 'test', image: 'http://127.0.0.1' })
        .success,
    ).toBe(false));
  it('bounded collage size', () =>
    expect(shareSchema.safeParse({ entity: 'test', count: 500 }).success).toBe(
      false,
    ));
  it('stable shuffle preserves membership', () => {
    expect(stableShuffle([1, 2, 3, 4], 'test')).toEqual(
      stableShuffle([4, 3, 2, 1], 'test'),
    );
    expect(stableShuffle([1, 2, 3, 4], 'test').sort()).toEqual([1, 2, 3, 4]);
  });
  it('copy uses only public presentation', () =>
    expect(
      suggestedCopy({
        title: 'Ugly',
        description: 'A story',
        eyebrow: '',
        stats: [],
        badges: [],
        tokens: [],
        path: '/',
        indexable: true,
      }),
    ).toBe('Ugly — A story'));
  for (const token of [0, 4445, NaN, 1.2])
    it('rejects untrusted token ' + token, () =>
      expect(() => trustedArtwork(token)).toThrow(),
    );
  it('fixed artwork origin', () =>
    expect(trustedArtwork(1)).toMatch(
      /^https:\/\/gateway.pinata.cloud\/ipfs\/Qm/,
    ));
  for (const response of [
    new Response('bad', { status: 500 }),
    new Response('<svg/>', { headers: { 'content-type': 'image/svg+xml' } }),
    new Response('bad', {
      headers: { 'content-type': 'image/png', 'content-length': '4000000' },
    }),
    new Response('bad', { headers: { 'content-type': 'image/png' } }),
  ])
    it('invalid art falls back', async () =>
      expect(await loadArtwork(1, async () => response)).toBeNull());
  it('timeout falls back', async () =>
    expect(
      await loadArtwork(1, async () => {
        throw new Error('timeout');
      }),
    ).toBeNull());
  it('valid PNG uses bounded inline data', async () => {
    const data = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(
      await loadArtwork(1, async (_u, init) => {
        expect(init?.redirect).toBe('error');
        return new Response(data, { headers: { 'content-type': 'image/png' } });
      }),
    ).toMatch(/^data:image\/png;base64,/);
  });
});

// Keep the shared auth payload bound while allowing a complete captioned gallery.
describe('gallery request budgets', () => {
  it('accepts a complete gallery within the explicit gallery budget', async () => {
    const { jsonBody } = await import('../src/server/http');
    const payload = {
      ...valid,
      items: Array.from({ length: 100 }, (_, i) => ({
        tokenId: i + 1,
        caption: '界'.repeat(180),
        section: '界'.repeat(40),
      })),
    };
    const parsed = await jsonBody(
      new Request('https://ugly.test', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
      131072,
    );
    expect(gallerySchema.parse(parsed).items).toHaveLength(100);
  });
  it('retains the smaller default for authentication requests', async () => {
    const { jsonBody } = await import('../src/server/http');
    await expect(
      jsonBody(
        new Request('https://ugly.test', {
          method: 'POST',
          body: JSON.stringify({ value: 'x'.repeat(17000) }),
        }),
      ),
    ).rejects.toThrow('BODY_TOO_LARGE');
  });
});
