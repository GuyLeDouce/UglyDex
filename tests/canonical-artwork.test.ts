import { afterEach, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { fetchCanonicalArtwork } from '../src/server/canonical-artwork';
import { SQUIG_ART_CID } from '../src/domain/assets';
afterEach(() => vi.unstubAllGlobals());
it('falls back on a gateway failure while preserving the CID and validating bytes', async () => {
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
    `https://gateway.pinata.cloud/ipfs/${SQUIG_ART_CID}/1416`,
    `https://ipfs.io/ipfs/${SQUIG_ART_CID}/1416`,
  ]);
  expect(fetcher.mock.calls[1][1].redirect).toBe('error');
});
it('rejects invalid artwork from both gateways and never accepts arbitrary token paths', async () => {
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
  expect(fetcher).toHaveBeenCalledTimes(2);
  await expect(fetchCanonicalArtwork(4445)).rejects.toThrow('INVALID_ARTWORK');
  expect(fetcher).toHaveBeenCalledTimes(2);
});
