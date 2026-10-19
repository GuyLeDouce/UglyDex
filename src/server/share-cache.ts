import 'server-only';
import { createHash } from 'node:crypto';
import { db } from './db';
import { artworkBatch } from './share-art';
import { renderShareSafe } from './share-render';
import type { ShareCard, ShareSpec } from '@/domain/sharing';
const cache = new Map<string, { at: number; bytes: Uint8Array }>();
const inflight = new Map<string, Promise<Uint8Array>>();
let rendering = 0;
const waiting: (() => void)[] = [];
async function acquireRenderer() {
  if (rendering < 2) {
    rendering++;
    return;
  }
  if (waiting.length >= 8) throw new Error('RENDER_BUSY');
  await new Promise<void>((resolve, reject) => {
    const ready = () => {
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(() => {
      waiting.splice(waiting.indexOf(ready), 1);
      reject(new Error('RENDER_BUSY'));
    }, 5000);
    waiting.push(ready);
  });
}
function releaseRenderer() {
  const next = waiting.shift();
  if (next)
    next(); // Transfer the reserved slot directly to the next job.
  else rendering--;
}
export async function shareLimit(subject = 'global', limit = 120) {
  const bucket = Math.floor(Date.now() / 60000),
    key = createHash('sha256')
      .update('share:' + subject + ':' + bucket)
      .digest('hex');
  const r = await db().rateLimitBucket.upsert({
    where: { key },
    create: { key, count: 1, expiresAt: new Date((bucket + 2) * 60000) },
    update: { count: { increment: 1 } },
  });
  if (r.count > limit) throw new Error('RATE_LIMITED');
}
export async function sharePng(card: ShareCard, spec: ShareSpec) {
  const start = Date.now(),
    key = createHash('sha256')
      .update(
        JSON.stringify({
          card,
          ratio: spec.ratio,
          template: spec.template,
          version: 3,
        }),
      )
      .digest('hex');
  const cached = cache.get(key);
  let hit = false,
    failed = 0,
    status = 'OK';
  try {
    if (cached && cached.at > Date.now() - 60000) {
      hit = true;
      return cached.bytes;
    }
    const running = inflight.get(key);
    if (running) {
      hit = true;
      return await running;
    }
    const work = (async () => {
      await acquireRenderer();
      try {
        await shareLimit('renders', 30);
        // Only server-projected, verified assets; never request-supplied URLs.
        const art = await artworkBatch(card.tokens, card.variants);
        failed = Object.values(art).filter((v) => !v).length;
        const rendered = await renderShareSafe(card, spec, art),
          bytes = rendered.bytes;
        if (rendered.fallback) {
          failed = card.tokens.length;
          status = 'FALLBACK';
        }
        if (bytes.length < 2_000_000) {
          if (cache.size >= 24) cache.delete(cache.keys().next().value!);
          cache.set(key, { at: Date.now(), bytes });
        }
        return bytes;
      } finally {
        releaseRenderer();
      }
    })().finally(() => inflight.delete(key));
    inflight.set(key, work);
    return await work;
  } catch (e) {
    status =
      e instanceof Error && e.message === 'RENDER_BUSY' ? 'BUSY' : 'FAILED';
    throw e;
  } finally {
    await db()
      .shareRenderMetric.create({
        data: {
          kind: spec.kind,
          status,
          cacheHit: hit,
          artworkFailures: failed,
          durationMs: Date.now() - start,
        },
      })
      .catch(() => {});
  }
}
