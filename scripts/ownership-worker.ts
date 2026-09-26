import 'dotenv/config';
import { ownershipWorkerBatch } from '../src/sync/ownership-worker';
import { db } from '../src/server/db';
import { readEnv } from '../src/server/env';
import { transferBatch } from '../src/sync/transfers';
import { seedAttributions, derivePending } from '../src/sync/provenance';
import { log } from '../src/server/log';
readEnv();
let stopped = false;
process.on('SIGTERM', () => {
  stopped = true;
});
process.on('SIGINT', () => {
  stopped = true;
});
try {
  await seedAttributions();
  do {
    let chainWorked = false;
    if (readEnv().ETH_RPC_URL && readEnv().SQUIGS_START_BLOCK !== undefined) {
      try {
        chainWorked = !!(await transferBatch());
      } catch {
        log('worker.chain_failed');
      }
    }
    await derivePending();
    const worked = (await ownershipWorkerBatch()) || chainWorked;
    if (process.argv.includes('--once')) break;
    if (!worked) await new Promise((r) => setTimeout(r, 5000));
  } while (!stopped);
} finally {
  await db().$disconnect();
}
