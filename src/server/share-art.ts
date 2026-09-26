import 'server-only';
import { resolveAsset, squigArtwork } from '@/domain/assets';
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
  number,
  { value: string | null; expires: number }
>();
const inflight = new Map<number, Promise<string | null>>();
let cacheBytes = 0;
async function cachedArtwork(token: number): Promise<string | null> {
  const old = artworkCache.get(token);
  if (old && old.expires > Date.now()) return old.value;
  const running = inflight.get(token);
  if (running) return running;
  const work = loadArtwork(token)
    .then((value) => {
      const previous = artworkCache.get(token);
      if (previous) {
        cacheBytes -= previous.value?.length ?? 0;
        artworkCache.delete(token);
      }
      const size = value?.length ?? 0;
      while (artworkCache.size >= 128 || cacheBytes + size > 24_000_000) {
        const key = artworkCache.keys().next().value;
        if (key === undefined) break;
        cacheBytes -= artworkCache.get(key)?.value?.length ?? 0;
        artworkCache.delete(key);
      }
      artworkCache.set(token, {
        value,
        expires: Date.now() + (value ? 86400000 : 30000),
      });
      cacheBytes += size;
      return value;
    })
    .finally(() => inflight.delete(token));
  inflight.set(token, work);
  return work;
}
export async function artworkBatch(tokens: number[]) {
  const result: Record<number, string | null> = {};
  for (let i = 0; i < tokens.length; i += 4)
    await Promise.all(
      tokens.slice(i, i + 4).map(async (n) => {
        result[n] = await cachedArtwork(n);
      }),
    );
  return result;
}
