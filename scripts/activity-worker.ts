import 'dotenv/config';
import { activityCycle } from '../src/sync/activity';
import { closeExternalPools } from '../src/integrations/read-only';
import { db } from '../src/server/db';
import { runWorker } from '../src/server/worker-runtime';
try {
  await runWorker(
    'ecosystem',
    async (signal) => {
      await activityCycle({ maxPages: 2 }, () => signal.aborted);
      return {
        failed: await db().integrationSource.count({
          where: { state: 'ERROR' },
        }),
      };
    },
    { once: process.argv.includes('--once'), intervalMs: 300000 },
  );
} catch {
  console.error('ECOSYSTEM_WORKER_FAILED');
  process.exitCode = 1;
} finally {
  await closeExternalPools();
  await db().$disconnect();
}
