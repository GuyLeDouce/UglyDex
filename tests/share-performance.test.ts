import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { shareSchema, type ShareCard } from '../src/domain/sharing';

const mocks = vi.hoisted(() => ({
  rate: vi.fn(),
  metric: vi.fn(),
  art: vi.fn(),
  render: vi.fn(),
}));
vi.mock('@/server/db', () => ({
  db: () => ({
    rateLimitBucket: { upsert: mocks.rate },
    shareRenderMetric: { create: mocks.metric },
  }),
}));
vi.mock('@/server/share-art', () => ({ artworkBatch: mocks.art }));
vi.mock('@/server/share-render', () => ({ renderShareSafe: mocks.render }));

const card: ShareCard = {
  title: 'Squig #1',
  eyebrow: '',
  description: '',
  stats: [],
  badges: [],
  tokens: [1],
  path: '/squig/1',
  indexable: true,
};
const spec = shareSchema.parse({ kind: 'squig', entity: '1' });
const rendered = { bytes: new Uint8Array([137, 80, 78, 71]), fallback: false };
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  mocks.rate.mockResolvedValue({ count: 1 });
  mocks.metric.mockResolvedValue({});
  mocks.art.mockResolvedValue({ 1: 'data:image/png;base64,test' });
  mocks.render.mockResolvedValue(rendered);
});
afterEach(() => {
  vi.useRealTimers();
});

describe('share render admission and reuse', () => {
  it('coalesces concurrent identical requests into one render and one render-budget charge', async () => {
    const { sharePng } = await import('../src/server/share-cache');
    const gate = deferred<typeof rendered>();
    mocks.render.mockReturnValue(gate.promise);
    const requests = Array.from({ length: 6 }, () => sharePng(card, spec));
    await vi.waitFor(() => expect(mocks.render).toHaveBeenCalledTimes(1));
    gate.resolve(rendered);
    const results = await Promise.all(requests);
    expect(results.every((bytes) => bytes === rendered.bytes)).toBe(true);
    expect(mocks.rate).toHaveBeenCalledTimes(1);
    expect(await sharePng(card, spec)).toBe(rendered.bytes);
    expect(mocks.render).toHaveBeenCalledTimes(1);
  });

  it('queues a burst while keeping at most two renders active', async () => {
    const { sharePng } = await import('../src/server/share-cache');
    const gates = Array.from({ length: 3 }, () => deferred<typeof rendered>());
    let started = 0,
      active = 0,
      peak = 0;
    mocks.render.mockImplementation(async () => {
      active++;
      peak = Math.max(peak, active);
      const result = await gates[started++].promise;
      active--;
      return result;
    });
    const requests = [1, 2, 3].map((n) =>
      sharePng({ ...card, title: String(n) }, spec),
    );
    await vi.waitFor(() => expect(started).toBe(2));
    gates[0].resolve(rendered);
    await vi.waitFor(() => expect(started).toBe(3));
    gates[1].resolve(rendered);
    gates[2].resolve(rendered);
    await Promise.all(requests);
    expect(peak).toBe(2);
  });

  it('bounds the queue and lets timed-out jobs retry without leaking a slot', async () => {
    vi.useFakeTimers();
    const { sharePng } = await import('../src/server/share-cache');
    const gate = deferred<typeof rendered>();
    mocks.render.mockReturnValue(gate.promise);
    const results = Promise.allSettled(
      Array.from({ length: 11 }, (_, n) =>
        sharePng({ ...card, title: String(n) }, spec),
      ),
    );
    await vi.advanceTimersByTimeAsync(5000);
    expect(mocks.render).toHaveBeenCalledTimes(2);
    gate.resolve(rendered);
    const settled = await results;
    expect(
      settled.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(2);
    expect(
      settled.filter((result) => result.status === 'rejected'),
    ).toHaveLength(9);
    for (const result of settled.slice(2))
      if (result.status === 'rejected')
        expect(result.reason.message).toBe('RENDER_BUSY');
    expect(await sharePng({ ...card, title: '2' }, spec)).toBe(rendered.bytes);
    expect(mocks.render).toHaveBeenCalledTimes(3);
  });

  it('releases failed work for a fresh retry and keys reuse by full content, shape and style', async () => {
    const { sharePng } = await import('../src/server/share-cache');
    mocks.render.mockRejectedValueOnce(new Error('renderer failed'));
    const requests = Promise.allSettled([
      sharePng(card, spec),
      sharePng(card, spec),
    ]);
    expect(
      (await requests).every((result) => result.status === 'rejected'),
    ).toBe(true);
    await sharePng(card, spec);
    await sharePng(card, { ...spec, template: 'ugly' });
    await sharePng(card, { ...spec, ratio: 'square' });
    await sharePng({ ...card, title: 'New name' }, spec);
    expect(mocks.render).toHaveBeenCalledTimes(5);
  });
});
