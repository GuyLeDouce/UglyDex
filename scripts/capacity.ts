import 'dotenv/config';
import { writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { sharePng } from '../src/server/share-cache';
import { shareSchema, type ShareCard } from '../src/domain/sharing';
import { db } from '../src/server/db';
import { operationalIntent } from '../src/domain/deployment';
export async function renderBaseline() {
  const spec = shareSchema.parse({ kind: 'squig', entity: '1' });
  const card: ShareCard = {
    title: 'UglyDex capacity fixture',
    eyebrow: 'CONTROLLED ASSETS',
    description: 'Local renderer baseline; no remote gateway requests',
    stats: [],
    badges: [],
    tokens: [],
    path: '/',
    indexable: false,
  };
  const rows = [];
  for (const [label, concurrency, cached] of [
    ['cold', 1, false],
    ['cached', 1, true],
    ['cold-5', 5, false],
    ['cold-10', 10, false],
    ['cached-10', 10, true],
    ['cached-burst', 20, true],
  ] as const) {
    const start = performance.now(),
      rssBefore = process.memoryUsage().rss;
    const outcomes = await Promise.all(
      Array.from({ length: concurrency }, async (_, i) => {
        const at = performance.now();
        try {
          const bytes = await sharePng(
            cached
              ? card
              : {
                  ...card,
                  title: label === 'cold' ? card.title : label + ':' + i,
                },
            spec,
          );
          return { ok: bytes.length > 1000, ms: performance.now() - at };
        } catch (e) {
          return {
            ok: false,
            ms: performance.now() - at,
            code:
              e instanceof Error && e.message === 'RENDER_BUSY'
                ? 'BUSY'
                : 'FAILED',
          };
        }
      }),
    );
    const times = outcomes.map((r) => r.ms).sort((a, b) => a - b);
    rows.push({
      label,
      concurrency,
      durationMs: Math.round(performance.now() - start),
      p50Ms: Math.round(times[Math.floor(times.length * 0.5)]),
      p95Ms: Math.round(
        times[Math.min(times.length - 1, Math.floor(times.length * 0.95))],
      ),
      failures: outcomes.filter((r) => !r.ok).length,
      busy: outcomes.filter((r) => 'code' in r && r.code === 'BUSY').length,
      rssBefore,
      rssAfter: process.memoryUsage().rss,
      artworkFetches: 0,
    });
  }
  return {
    environment: 'local controlled renderer',
    at: new Date().toISOString(),
    node: process.version,
    rows,
  };
}
async function main() {
  operationalIntent('capacity');
  const report = await renderBaseline();
  await writeFile(
    '.data/phase8-render-capacity.json',
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
  await db().$disconnect();
}
if (process.argv[1]?.endsWith('capacity.ts'))
  main().catch(() => {
    console.error('CAPACITY_FAILED');
    process.exitCode = 1;
  });
