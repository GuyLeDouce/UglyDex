import 'server-only';
import { createHash } from 'node:crypto';
import { db } from './db';
import { artworkBatch } from './share-art';
import { renderShareSafe } from './share-render';
import type { ShareCard, ShareSpec } from '@/domain/sharing';
const cache = new Map<string, { at: number; bytes: Uint8Array }>();
let rendering = 0;
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
          version: 1,
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
    if (rendering >= 2) throw new Error('RENDER_BUSY');
    rendering++;
    try {
      await shareLimit('renders', 30);
      const art = await artworkBatch(card.tokens);
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
      rendering--;
    }
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
