import { afterEach, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { fetchCanonicalArtwork } from '../src/server/canonical-artwork';
import { SQUIG_ART_CID } from '../src/domain/assets';
afterEach(() => vi.unstubAllGlobals());
it('falls back on a mirror failure while preserving the CID and validating bytes', async () => {
  const png = await sharp({
    create: { width: 32, height: 32, channels: 4, background: '#fff' },
  })
    .png()
    .toBuffer();
  const fetcher = vi
    .fn()
    .mockRejectedValueOnce(new Error('timeout'))
    .mockResolvedValueOnce(
      new Response(new Uint8Array(png), {
        headers: { 'content-type': 'image/png' },
      }),
    );
  vi.stubGlobal('fetch', fetcher);
  const result = await fetchCanonicalArtwork(1416);
  expect(result.bytes).toEqual(png);
  expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
    `https://squigs.io/images/images/1416.png`,
    `https://gateway.pinata.cloud/ipfs/${SQUIG_ART_CID}/1416`,
  ]);
  expect(fetcher.mock.calls[1][1].redirect).toBe('error');
});
it('rejects invalid artwork from all sources and never accepts arbitrary token paths', async () => {
  const fetcher = vi
    .fn()
    .mockImplementation(
      async () =>
        new Response('<svg/>', { headers: { 'content-type': 'image/png' } }),
    );
  vi.stubGlobal('fetch', fetcher);
  await expect(fetchCanonicalArtwork(1)).rejects.toThrow(
    'INVALID_ARTWORK_SIGNATURE',
  );
  expect(fetcher).toHaveBeenCalledTimes(3);
  await expect(fetchCanonicalArtwork(4445)).rejects.toThrow('INVALID_ARTWORK');
  expect(fetcher).toHaveBeenCalledTimes(3);
});

it('uses the collection mirror first without requesting slower gateways', async () => {
  const png = await sharp({
    create: { width: 32, height: 32, channels: 4, background: '#fff' },
  })
    .png()
    .toBuffer();
  const fetcher = vi.fn().mockResolvedValue(
    new Response(new Uint8Array(png), {
      headers: { 'content-type': 'image/png' },
    }),
  );
  vi.stubGlobal('fetch', fetcher);
  const result = await fetchCanonicalArtwork(4444);
  expect(result.bytes).toEqual(png);
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(fetcher.mock.calls[0][0]).toBe(
    'https://squigs.io/images/images/4444.png',
  );
  expect(fetcher.mock.calls[0][1].redirect).toBe('error');
});

it('retains the second IPFS gateway when the mirror and first gateway fail', async () => {
  const png = await sharp({
    create: { width: 32, height: 32, channels: 4, background: '#fff' },
  })
    .png()
    .toBuffer();
  const fetcher = vi
    .fn()
    .mockRejectedValueOnce(new Error('timeout'))
    .mockResolvedValueOnce(new Response('unavailable', { status: 503 }))
    .mockResolvedValueOnce(
      new Response(new Uint8Array(png), {
        headers: { 'content-type': 'image/png' },
      }),
    );
  vi.stubGlobal('fetch', fetcher);
  expect((await fetchCanonicalArtwork(1)).bytes).toEqual(png);
  expect(fetcher.mock.calls[2][0]).toBe(
    `https://ipfs.io/ipfs/${SQUIG_ART_CID}/1`,
  );
});
