import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { SQUIG_ART_CID } from '../src/domain/assets';
import {
  canonicalArtworkToken,
  artworkUrl,
} from '../src/domain/artwork-delivery';

const mocks = vi.hoisted(() => ({ source: vi.fn(), send: vi.fn() }));
vi.mock('@/server/collectible-art', () => ({
  inspectCollectibleArtwork: mocks.source,
}));
vi.mock('@aws-sdk/client-s3', () => {
  class GetObjectCommand {
    constructor(public input: Record<string, unknown>) {}
  }
  class PutObjectCommand {
    constructor(public input: Record<string, unknown>) {}
  }
  class HeadObjectCommand {
    constructor(public input: Record<string, unknown>) {}
  }
  class S3Client {
    send = mocks.send;
  }
  return { GetObjectCommand, PutObjectCommand, HeadObjectCommand, S3Client };
});
const objects = new Map<string, { bytes: Buffer; mime: string }>();
let png: Buffer;
beforeEach(async () => {
  vi.resetModules();
  vi.resetAllMocks();
  objects.clear();
  for (const [key, value] of Object.entries({
    ENDPOINT: 'https://storage.test',
    BUCKET: 'images',
    ACCESS_KEY_ID: 'fixture',
    SECRET_ACCESS_KEY: 'fixture',
  }))
    vi.stubEnv('ARTWORK_S3_' + key, value);
  png = await sharp({
    create: { width: 512, height: 512, channels: 4, background: '#08aabb' },
  })
    .png()
    .toBuffer();
  mocks.source.mockResolvedValue({ bytes: png, mime: 'image/png' });
  mocks.send.mockImplementation(
    async (command: {
      constructor: { name: string };
      input: { Key: string; Body: Buffer; ContentType: string };
    }) => {
      const key = command.input.Key;
      if (command.constructor.name === 'PutObjectCommand') {
        objects.set(key, {
          bytes: Buffer.from(command.input.Body),
          mime: command.input.ContentType,
        });
        return {};
      }
      const item = objects.get(key);
      if (!item)
        throw Object.assign(new Error('missing'), { name: 'NoSuchKey' });
      if (command.constructor.name === 'HeadObjectCommand') return {};
      return {
        ContentLength: item.bytes.length,
        ContentType: item.mime,
        Body: { transformToByteArray: async () => item.bytes },
      };
    },
  );
});
afterEach(() => vi.unstubAllEnvs());

describe('durable artwork mirror', () => {
  it('downloads once, saves an unchanged original and smaller WebP, and reuses stored files after restart', async () => {
    const { squigImage } = await import('../src/server/artwork-store');
    const [first, duplicate] = await Promise.all([
      squigImage(1, 96),
      squigImage(1, 96),
    ]);
    expect(first).toBe(duplicate);
    expect(mocks.source).toHaveBeenCalledTimes(1);
    expect(objects.get(`squigs/${SQUIG_ART_CID}/v1/1/original`)?.bytes).toEqual(
      png,
    );
    expect(await sharp(first.bytes).metadata()).toMatchObject({
      width: 96,
      height: 96,
      format: 'webp',
    });
    vi.resetModules();
    const restarted = await import('../src/server/artwork-store');
    expect((await restarted.squigImage(1, 96)).bytes).toEqual(first.bytes);
    expect(mocks.source).toHaveBeenCalledTimes(1);
  });
  it('allows gateway fallback during a storage outage but does not report a successful import', async () => {
    const { squigImage } = await import('../src/server/artwork-store');
    mocks.send.mockRejectedValue(new Error('storage unavailable'));
    expect((await squigImage(1)).bytes).toEqual(png);
    await expect(squigImage(1, 'original', true)).rejects.toThrow(
      'storage unavailable',
    );
  });
  it('checks a completion marker without fetching the collection again', async () => {
    objects.set(`squigs/${SQUIG_ART_CID}/v1/complete.json`, {
      bytes: Buffer.from('{}'),
      mime: 'application/json',
    });
    const { warmArtwork } = await import('../src/server/artwork-store');
    expect(await warmArtwork()).toEqual({
      complete: true,
      imported: 0,
      failed: 0,
    });
    expect(mocks.source).not.toHaveBeenCalled();
  });
  it('rejects incomplete credentials and invalid tokens before external work', async () => {
    const { artworkStorageConfigured, squigImage } =
      await import('../src/server/artwork-store');
    vi.stubEnv('ARTWORK_S3_SECRET_ACCESS_KEY', '');
    expect(() => artworkStorageConfigured()).toThrow(
      'INCOMPLETE_ARTWORK_STORAGE',
    );
    for (const token of [0, 4445, NaN, 1.2])
      await expect(squigImage(token)).rejects.toThrow('INVALID_ARTWORK');
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.source).not.toHaveBeenCalled();
  });
  it('serves immutable images with ETags and rejects arbitrary paths or sizes', async () => {
    const { GET } =
      await import('../src/app/api/artwork/squigs/[cid]/[token]/[size]/route');
    const request = new Request('https://ugly.test/image');
    const params = { cid: SQUIG_ART_CID, token: '1', size: '96' };
    const response = await GET(request, { params: Promise.resolve(params) });
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/webp');
    expect(response.headers.get('Cache-Control')).toContain('immutable');
    const cached = await GET(
      new Request(request, {
        headers: { 'If-None-Match': response.headers.get('ETag')! },
      }),
      { params: Promise.resolve(params) },
    );
    expect(cached.status).toBe(304);
    for (const patch of [
      { cid: 'untrusted' },
      { token: '4445' },
      { token: '../1' },
      { size: '10000' },
      { size: '096' },
    ])
      expect(
        (
          await GET(request, {
            params: Promise.resolve({ ...params, ...patch }),
          })
        ).status,
      ).toBe(404);
  });
  it('does not cache errors as permanent images', async () => {
    const { GET } =
      await import('../src/app/api/artwork/squigs/[cid]/[token]/[size]/route');
    mocks.source.mockRejectedValue(new Error('gateway unavailable'));
    const response = await GET(new Request('https://ugly.test/image'), {
      params: Promise.resolve({ cid: SQUIG_ART_CID, token: '1', size: '96' }),
    });
    expect(response.status).toBe(503);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });
});

describe('canonical artwork delivery mapping', () => {
  it('maps IPFS and HTTPS originals to stable local sizes without accepting unrelated URLs', () => {
    expect(canonicalArtworkToken(`ipfs://${SQUIG_ART_CID}/1`)).toBe(1);
    expect(
      canonicalArtworkToken(
        `https://gateway.pinata.cloud/ipfs/${SQUIG_ART_CID}/4444`,
      ),
    ).toBe(4444);
    expect(canonicalArtworkToken('https://example.com/1')).toBeNull();
    expect(canonicalArtworkToken(`ipfs://${SQUIG_ART_CID}/4445`)).toBeNull();
    expect(artworkUrl(1, 320)).toBe(
      `/api/artwork/squigs/${SQUIG_ART_CID}/1/384`,
    );
    expect(artworkUrl(1, 900)).toContain('/1/1536');
  });
});
