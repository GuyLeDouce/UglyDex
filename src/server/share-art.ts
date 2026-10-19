import 'server-only';
import { resolveAsset, squigArtwork } from '@/domain/assets';
import type { ShareCard } from '@/domain/sharing';
import { collectibleArtworkData } from './collectible-art';
import { squigImage } from './artwork-store';
export function trustedArtwork(token: number) {
  if (!Number.isInteger(token) || token < 1 || token > 4444)
    throw new Error('INVALID_TOKEN');
  return resolveAsset(squigArtwork(token))!;
}
export async function loadArtwork(
  token: number,
  fetcher: typeof fetch = fetch,
): Promise<string | null> {
  try {
    const response = await fetcher(trustedArtwork(token), {
      signal: AbortSignal.timeout(8000),
      redirect: 'error',
      cache: 'no-store',
    });
    if (
      !response.ok ||
      !new RegExp('^image/(png|jpeg)(;|$)', 'i').test(
        response.headers.get('content-type') ?? '',
      ) ||
      Number(response.headers.get('content-length') ?? 0) > 3_000_000
    )
      return null;
    const reader = response.body?.getReader();
    if (!reader) return null;
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 3_000_000) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    const bytes = Buffer.concat(chunks);
    const png = bytes
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const jpg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    return png || jpg
      ? 'data:image/' +
          (png ? 'png' : 'jpeg') +
          ';base64,' +
          bytes.toString('base64')
      : null;
  } catch {
    return null;
  }
}
const artworkCache = new Map<
  string,
  { value: string | null; expires: number }
>();
const inflight = new Map<string, Promise<string | null>>();
let cacheBytes = 0;
async function cachedArtwork(
  key: string,
  load: () => Promise<string | null>,
): Promise<string | null> {
  const old = artworkCache.get(key);
  if (old && old.expires > Date.now()) return old.value;
  const running = inflight.get(key);
  if (running) return running;
  const work = load()
    .then((value) => {
      const previous = artworkCache.get(key);
      if (previous) {
        cacheBytes -= previous.value?.length ?? 0;
        artworkCache.delete(key);
      }
      const size = value?.length ?? 0;
      while (artworkCache.size >= 128 || cacheBytes + size > 24_000_000) {
        const key = artworkCache.keys().next().value;
        if (key === undefined) break;
        cacheBytes -= artworkCache.get(key)?.value?.length ?? 0;
        artworkCache.delete(key);
      }
      artworkCache.set(key, {
        value,
        expires: Date.now() + (value ? 86400000 : 30000),
      });
      cacheBytes += size;
      return value;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, work);
  return work;
}
export async function artworkBatch(
  tokens: number[],
  variants: ShareCard['variants'] = {},
) {
  const result: Record<number, string | null> = {};
  const pending = [...new Set(tokens)];
  let next = 0;
  // Keep four fetches busy without waiting for the slowest image in a batch.
  await Promise.all(
    Array.from({ length: Math.min(4, pending.length) }, async () => {
      while (next < pending.length) {
        const token = pending[next++],
          variant = variants[token];
        // A selected custom replaces the original; do not download both.
        result[token] = variant
          ? await cachedArtwork(JSON.stringify(variant), () =>
              collectibleArtworkData(variant.uri, variant.sha256),
            )
          : await cachedArtwork('squig:' + token, async () => {
              try {
                const image = await squigImage(token);
                return `data:${image.mime};base64,${image.bytes.toString('base64')}`;
              } catch {
                return null;
              }
            });
      }
    }),
  );
  return result;
}
