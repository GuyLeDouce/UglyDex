import 'server-only';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { collectibleImageUrl } from '@/domain/collectibles';
const limit = 3_000_000;
export async function inspectCollectibleArtwork(
  uri: string,
  fetcher: typeof fetch = fetch,
) {
  const url = collectibleImageUrl(uri);
  const response = await fetcher(url, {
    redirect: 'error',
    signal: AbortSignal.timeout(8000),
    cache: 'no-store',
  });
  const mime = (response.headers.get('content-type') ?? '')
    .split(';')[0]
    .toLowerCase();
  if (
    !response.ok ||
    !['image/png', 'image/jpeg'].includes(mime) ||
    Number(response.headers.get('content-length') ?? 0) > limit
  )
    throw new Error('INVALID_ARTWORK_RESPONSE');
  const reader = response.body?.getReader();
  if (!reader) throw new Error('EMPTY_ARTWORK');
  const chunks: Uint8Array[] = [];
  let length = 0;
  for (;;) {
    const chunk = await reader.read();
    if (chunk.done) break;
    length += chunk.value.length;
    if (length > limit) {
      await reader.cancel();
      throw new Error('ARTWORK_TOO_LARGE');
    }
    chunks.push(chunk.value);
  }
  const bytes = Buffer.concat(chunks);
  const png =
    bytes.length >= 8 &&
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpeg =
    bytes.length >= 3 &&
    bytes[0] === 255 &&
    bytes[1] === 216 &&
    bytes[2] === 255;
  // Do not hand a mislabeled SVG/XML document to an image parser at all.
  if ((mime === 'image/png' && !png) || (mime === 'image/jpeg' && !jpeg))
    throw new Error('INVALID_ARTWORK_SIGNATURE');
  const image = sharp(bytes, {
    limitInputPixels: 16777216,
    animated: false,
    failOn: 'warning',
  });
  const metadata = await image.metadata();
  if (
    !['png', 'jpeg'].includes(metadata.format ?? '') ||
    mime !== `image/${metadata.format}` ||
    !metadata.width ||
    !metadata.height ||
    metadata.width > 4096 ||
    metadata.height > 4096 ||
    (metadata.pages ?? 1) > 1
  )
    throw new Error('UNSUPPORTED_ARTWORK');
  // Decode all pixels before approval, rejecting corrupt compressed streams.
  await image.resize(32, 32).raw().toBuffer();
  return {
    id: createHash('sha256').update(uri).digest('hex'),
    uri,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    mime,
    width: metadata.width,
    height: metadata.height,
    byteLength: bytes.length,
    bytes,
  };
}
export async function collectibleArtworkData(uri: string, sha256: string) {
  try {
    const a = await inspectCollectibleArtwork(uri);
    return a.sha256 === sha256
      ? `data:${a.mime};base64,${a.bytes.toString('base64')}`
      : null;
  } catch {
    return null;
  }
}
