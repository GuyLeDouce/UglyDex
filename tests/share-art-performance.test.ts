import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ custom: vi.fn() }));
vi.mock('@/server/collectible-art', () => ({
  collectibleArtworkData: mocks.custom,
}));
vi.mock('@/server/artwork-store', () => ({
  squigImage: async (token: number) => {
    const response = await fetch(`https://artwork.test/${token}`);
    return {
      bytes: Buffer.from(await response.arrayBuffer()),
      mime: 'image/png',
    };
  },
}));
const png = () =>
  new Response(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), {
    headers: { 'Content-Type': 'image/png' },
  });
beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('artwork loading throughput', () => {
  it('starts later artwork while an earlier image is stalled, with four fetches maximum', async () => {
    const { artworkBatch } = await import('../src/server/share-art');
    let release!: () => void;
    const slow = new Promise<void>((resolve) => {
      release = resolve;
    });
    const started: number[] = [];
    let active = 0,
      peak = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const token = Number(url.split('/').pop());
        started.push(token);
        active++;
        peak = Math.max(peak, active);
        if (token === 1) await slow;
        active--;
        return png();
      }),
    );
    const work = artworkBatch([1, 2, 3, 4, 5, 6, 7, 8]);
    await vi.waitFor(() => expect(started).toContain(8));
    release();
    const result = await work;
    expect(Object.keys(result)).toHaveLength(8);
    expect(Object.values(result).every(Boolean)).toBe(true);
    expect(peak).toBeLessThanOrEqual(4);
  });

  it('fetches only selected custom artwork and caches by URI plus verified hash', async () => {
    const { artworkBatch } = await import('../src/server/share-art');
    const fetcher = vi.fn(async () => png());
    vi.stubGlobal('fetch', fetcher);
    mocks.custom.mockResolvedValue('data:image/png;base64,custom');
    const variants = { 1: { uri: 'ipfs://verified/1', sha256: 'first-hash' } };
    const [a, b] = await Promise.all([
      artworkBatch([1], variants),
      artworkBatch([1], variants),
    ]);
    expect(a).toEqual(b);
    expect(mocks.custom).toHaveBeenCalledTimes(1);
    expect(fetcher).not.toHaveBeenCalled();
    await artworkBatch([1], variants);
    expect(mocks.custom).toHaveBeenCalledTimes(1);
    await artworkBatch([1], { 1: { ...variants[1], sha256: 'changed-hash' } });
    expect(mocks.custom).toHaveBeenCalledTimes(2);
    await artworkBatch([1]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
