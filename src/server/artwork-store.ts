import 'server-only';
import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { SQUIG_ART_CID, squigArtwork } from '@/domain/assets';
import { artworkWidths, type ArtworkSize } from '@/domain/artwork-delivery';
import { inspectCollectibleArtwork } from './collectible-art';

// Only immutable public collection artwork belongs here. Never store profile cards.
const prefix = `squigs/${SQUIG_ART_CID}/v1/`;
const limit = 3_000_000;
type Asset = { bytes: Buffer; mime: string; persisted?: boolean };
const cache = new Map<string, Asset>();
let cacheBytes = 0;
const inflight = new Map<string, Promise<Asset>>();
let client: S3Client | undefined;
export function artworkStorageConfigured() {
  const values = [
    'ENDPOINT',
    'BUCKET',
    'ACCESS_KEY_ID',
    'SECRET_ACCESS_KEY',
  ].map((name) => process.env['ARTWORK_S3_' + name]);
  if (values.some(Boolean) && !values.every(Boolean))
    throw new Error('INCOMPLETE_ARTWORK_STORAGE');
  return values.every(Boolean);
}
function storage() {
  if (!artworkStorageConfigured()) return null;
  if (!client) {
    const endpoint = new URL(process.env.ARTWORK_S3_ENDPOINT!);
    if (
      endpoint.protocol !== 'https:' ||
      endpoint.username ||
      endpoint.password
    )
      throw new Error('INVALID_ARTWORK_STORAGE_ENDPOINT');
    client = new S3Client({
      endpoint: endpoint.href,
      region: process.env.ARTWORK_S3_REGION || 'auto',
      forcePathStyle: process.env.ARTWORK_S3_PATH_STYLE === 'true',
      credentials: {
        accessKeyId: process.env.ARTWORK_S3_ACCESS_KEY_ID!,
        secretAccessKey: process.env.ARTWORK_S3_SECRET_ACCESS_KEY!,
      },
      maxAttempts: 2,
      requestHandler: {
        connectionTimeout: 2000,
        requestTimeout: 5000,
        socketTimeout: 5000,
        throwOnRequestTimeout: true,
      },
    });
  }
  return { client, bucket: process.env.ARTWORK_S3_BUCKET! };
}
async function readStored(key: string): Promise<Asset | null> {
  const s3 = storage();
  if (!s3) return null;
  try {
    const response = await s3.client.send(
      new GetObjectCommand({
        Bucket: s3.bucket,
        Key: prefix + key,
      }),
      { abortSignal: AbortSignal.timeout(7000) },
    );
    if (!response.Body) throw new Error('EMPTY_STORED_ARTWORK');
    if (
      (response.ContentLength ?? Infinity) > limit ||
      !['image/png', 'image/jpeg', 'image/webp'].includes(
        response.ContentType ?? '',
      )
    ) {
      // Stop consuming any unexpected or oversized object.
      const stream = response.Body as typeof response.Body & {
        destroy?: () => void;
      };
      stream.destroy?.();
      throw new Error('INVALID_STORED_ARTWORK');
    }
    const bytes = Buffer.from(await response.Body.transformToByteArray());
    if (!bytes.length || bytes.length > limit)
      throw new Error('INVALID_STORED_ARTWORK');
    return { bytes, mime: response.ContentType!, persisted: true };
  } catch (error) {
    if (
      error instanceof Error &&
      ['NoSuchKey', 'NotFound'].includes(error.name)
    )
      return null;
    throw error;
  }
}
async function writeStored(key: string, asset: Asset) {
  const s3 = storage();
  if (!s3) throw new Error('ARTWORK_STORAGE_NOT_CONFIGURED');
  await s3.client.send(
    new PutObjectCommand({
      Bucket: s3.bucket,
      Key: prefix + key,
      Body: asset.bytes,
      ContentType: asset.mime,
      CacheControl: 'public, max-age=31536000, immutable',
    }),
    { abortSignal: AbortSignal.timeout(10000) },
  );
}
function remember(key: string, asset: Asset) {
  if (asset.bytes.length > limit) return;
  const previous = cache.get(key);
  if (previous) {
    cacheBytes -= previous.bytes.length;
    cache.delete(key);
  }
  while (cache.size >= 256 || cacheBytes + asset.bytes.length > 32_000_000) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cacheBytes -= cache.get(oldest)!.bytes.length;
    cache.delete(oldest);
  }
  cache.set(key, asset);
  cacheBytes += asset.bytes.length;
}

let active = 0;
const waiting: (() => void)[] = [];
async function limited<T>(work: () => Promise<T>): Promise<T> {
  if (active >= 4) {
    if (waiting.length >= 32) throw new Error('ARTWORK_BUSY');
    await new Promise<void>((resolve, reject) => {
      const ready = () => {
        clearTimeout(timer);
        resolve();
      };
      const timer = setTimeout(() => {
        waiting.splice(waiting.indexOf(ready), 1);
        reject(new Error('ARTWORK_BUSY'));
      }, 15000);
      waiting.push(ready);
    });
  } else active++;
  try {
    return await work();
  } finally {
    const next = waiting.shift();
    if (next) next();
    else active--;
  }
}

export async function squigImage(
  token: number,
  size: ArtworkSize = 'original',
  requireStorage = false,
): Promise<Asset> {
  if (
    !Number.isInteger(token) ||
    token < 1 ||
    token > 4444 ||
    (size !== 'original' && !artworkWidths.includes(size))
  )
    throw new Error('INVALID_ARTWORK');
  const key = `${token}/${size}`;
  const workKey = key + (requireStorage ? ':persist' : '');
  // The importer verifies persistence, even if a request warmed memory already.
  const cached = cache.get(key);
  if (cached && (!requireStorage || cached.persisted)) return cached;
  const running = inflight.get(workKey);
  if (running) return running;
  if (inflight.size >= 64) throw new Error('ARTWORK_BUSY');
  const work = (async () => {
    let stored: Asset | null = null;
    try {
      stored = await readStored(key);
    } catch (error) {
      if (requireStorage) throw error;
    }
    if (stored) {
      remember(key, stored);
      return stored;
    }
    let asset: Asset;
    if (size === 'original') {
      const source = await limited(() =>
        inspectCollectibleArtwork(squigArtwork(token), (url, init) =>
          fetch(url, { ...init, signal: AbortSignal.timeout(15000) }),
        ),
      );
      asset = { bytes: source.bytes, mime: source.mime };
    } else {
      const original = await squigImage(token, 'original', requireStorage);
      asset = {
        bytes: await limited(() =>
          sharp(original.bytes, { limitInputPixels: 16777216 })
            .resize({
              width: size,
              height: size,
              fit: 'inside',
              withoutEnlargement: true,
            })
            .webp({ quality: 85, effort: 3 })
            .toBuffer(),
        ),
        mime: 'image/webp',
      };
    }
    let canPersist = false;
    try {
      canPersist = artworkStorageConfigured();
    } catch (error) {
      if (requireStorage) throw error;
    }
    if (canPersist) {
      try {
        await writeStored(key, asset);
        asset.persisted = true;
      } catch (error) {
        if (requireStorage) throw error;
      }
    } else if (requireStorage)
      throw new Error('ARTWORK_STORAGE_NOT_CONFIGURED');
    remember(key, asset);
    return asset;
  })().finally(() => inflight.delete(workKey));
  inflight.set(workKey, work);
  return work;
}

// A completion marker makes later boots a single storage check. Partial imports
// resume from existing immutable objects; only two tokens are imported at once.
export async function warmArtwork() {
  const s3 = storage();
  if (!s3) throw new Error('ARTWORK_STORAGE_NOT_CONFIGURED');
  const marker = prefix + 'complete.json';
  try {
    await s3.client.send(
      new HeadObjectCommand({ Bucket: s3.bucket, Key: marker }),
      { abortSignal: AbortSignal.timeout(7000) },
    );
    return { complete: true, imported: 0, failed: 0 };
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !['NoSuchKey', 'NotFound'].includes(error.name)
    )
      throw error;
  }
  let next = 1,
    imported = 0,
    failed = 0;
  await Promise.all(
    Array.from({ length: 2 }, async () => {
      while (next <= 4444) {
        const token = next++;
        let done = false;
        for (let attempt = 0; attempt < 3 && !done; attempt++) {
          try {
            await squigImage(token, 'original', true);
            for (const size of artworkWidths)
              await squigImage(token, size, true);
            done = true;
          } catch {
            await new Promise((resolve) =>
              setTimeout(resolve, 1000 * (attempt + 1)),
            );
          }
        }
        if (done) imported++;
        else failed++;
        if ((imported + failed) % 100 === 0)
          console.log(
            JSON.stringify({
              event: 'artwork.import.progress',
              imported,
              failed,
              total: 4444,
            }),
          );
      }
    }),
  );
  if (!failed)
    await s3.client.send(
      new PutObjectCommand({
        Bucket: s3.bucket,
        Key: marker,
        Body: JSON.stringify({
          cid: SQUIG_ART_CID,
          count: 4444,
          sizes: artworkWidths,
          completedAt: new Date().toISOString(),
        }),
        ContentType: 'application/json',
      }),
      { abortSignal: AbortSignal.timeout(10000) },
    );
  return { complete: failed === 0, imported, failed };
}
