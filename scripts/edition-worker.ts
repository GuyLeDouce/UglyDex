import 'dotenv/config';
import { db } from '../src/server/db';
import { editionIndexBatch } from '../src/server/edition-indexer';
import { setTimeout as delay } from 'node:timers/promises';
const stop = new AbortController();
process.once('SIGTERM', () => stop.abort());
process.once('SIGINT', () => stop.abort());
try {
  do {
    const contracts = await db().editionContract.findMany({
      where: { enabled: true, status: 'VERIFIED' },
      orderBy: { id: 'asc' },
      take: 100,
    });
    for (const c of contracts) {
      if (stop.signal.aborted) break;
      try {
        await editionIndexBatch(c.id);
      } catch {
        console.error('EDITION_BATCH_HALTED');
      }
    }
    if (process.argv.includes('--once')) break;
    await delay(15000, undefined, { signal: stop.signal }).catch(() => {});
  } while (!stop.signal.aborted);
} finally {
  await db().$disconnect();
}
