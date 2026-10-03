import 'dotenv/config';
import { activityCycle } from '../src/sync/activity';
import { closeExternalPools } from '../src/integrations/read-only';
import { db } from '../src/server/db';
import { runWorker } from '../src/server/worker-runtime';
import { syncDripDue } from '../src/server/drip-sync';
let nextSourcePoll = 0;
try {
  await runWorker(
    'ecosystem',
    async (signal) => {
      if (Date.now() >= nextSourcePoll) {
        await activityCycle({ maxPages: 2 }, () => signal.aborted);
        nextSourcePoll = Date.now() + 300000;
      }
      if (!signal.aborted) await syncDripDue().catch(() => {});
      return {
        failed: await db().integrationSource.count({
          where: { state: 'ERROR' },
        }),
      };
    },
    { once: process.argv.includes('--once'), intervalMs: 10000 },
  );
} catch {
  console.error('ECOSYSTEM_WORKER_FAILED');
  process.exitCode = 1;
} finally {
  await closeExternalPools();
  await db().$disconnect();
}
