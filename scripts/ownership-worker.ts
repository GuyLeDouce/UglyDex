import 'dotenv/config';
import { ownershipWorkerBatch } from '../src/sync/ownership-worker';
import { db } from '../src/server/db';
import { transferBatch } from '../src/sync/transfers';
import { seedAttributions, derivePending } from '../src/sync/provenance';
import { runWorker } from '../src/server/worker-runtime';
try {
  await runWorker(
    'blockchain',
    async (signal) => {
      await seedAttributions();
      const scanned = signal.aborted ? false : await transferBatch();
      const derived = signal.aborted ? 0 : await derivePending();
      const refreshed = signal.aborted ? false : await ownershipWorkerBatch();
      return { scanned: !!scanned, derived, refreshed: !!refreshed };
    },
    { once: process.argv.includes('--once'), intervalMs: 5000 },
  );
} catch {
  console.error('BLOCKCHAIN_WORKER_FAILED');
  process.exitCode = 1;
} finally {
  await db().$disconnect();
}
