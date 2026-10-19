import { createHash } from 'node:crypto';
import { SQUIG_ART_CID } from '@/domain/assets';
import { artworkWidths, type ArtworkSize } from '@/domain/artwork-delivery';
import { squigImage } from '@/server/artwork-store';
export const runtime = 'nodejs';
export async function GET(
  request: Request,
  context: { params: Promise<{ cid: string; token: string; size: string }> },
) {
  const { cid, token, size } = await context.params;
  if (
    cid !== SQUIG_ART_CID ||
    !/^[1-9][0-9]{0,3}$/.test(token) ||
    Number(token) > 4444 ||
    (size !== 'original' &&
      !artworkWidths.some((width) => String(width) === size))
  )
    return new Response('Not found', {
      status: 404,
      headers: { 'Cache-Control': 'no-store' },
    });
  try {
    const image = await squigImage(
      Number(token),
      size === 'original' ? size : (Number(size) as ArtworkSize),
    );
    const etag =
      '"' + createHash('sha256').update(image.bytes).digest('hex') + '"';
    const headers = {
      'Content-Type': image.mime,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      ETag: etag,
    };
    if (request.headers.get('if-none-match') === etag)
      return new Response(null, { status: 304, headers });
    return new Response(new Uint8Array(image.bytes), { headers });
  } catch (error) {
    return new Response('Artwork temporarily unavailable', {
      status:
        error instanceof Error && error.message === 'ARTWORK_BUSY' ? 429 : 503,
      headers: { 'Cache-Control': 'no-store', 'Retry-After': '2' },
    });
  }
}
