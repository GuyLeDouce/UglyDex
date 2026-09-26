import 'dotenv/config';
import { activityCycle } from '../src/sync/activity';
import { closeExternalPools } from '../src/integrations/read-only';
import { db } from '../src/server/db';
import { log } from '../src/server/log';
let stopping = false;
process.on('SIGTERM', () => {
  stopping = true;
});
process.on('SIGINT', () => {
  stopping = true;
});
try {
  do {
    await activityCycle({ maxPages: 2 });
    if (process.argv.includes('--once')) break;
    for (let i = 0; i < 60 && !stopping; i++)
      await new Promise((r) => setTimeout(r, 5000));
  } while (!stopping);
} catch {
  log('activity.worker_failed');
  process.exitCode = 1;
} finally {
  await closeExternalPools();
  await db().$disconnect();
}
