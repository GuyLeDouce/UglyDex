import 'dotenv/config';
import { activityCycle } from '../src/sync/activity';
import { closeExternalPools } from '../src/integrations/read-only';
import { db } from '../src/server/db';
import { runWorker } from '../src/server/worker-runtime';
import { syncDripDue } from '../src/server/drip-sync';
import { log } from '../src/server/log';
let nextSourcePoll = 0;
let nextDripReport = 0;
let lastDripStatus = '';
async function reportSources() {
  const sources = await db().integrationSource.findMany({
    select: {
      id: true,
      state: true,
      warning: true,
      schemaValid: true,
      lastSuccessAt: true,
      lastAttemptAt: true,
      backfillFinishedAt: true,
      importedThrough: true,
    },
  });
  for (const source of sources)
    log('ecosystem.source_status', {
      source: source.id,
      state: source.state,
      warning: source.warning,
      schemaValid: source.schemaValid,
      lastSuccessAt: source.lastSuccessAt?.toISOString() ?? null,
      lastAttemptAt: source.lastAttemptAt?.toISOString() ?? null,
      backfillFinishedAt: source.backfillFinishedAt?.toISOString() ?? null,
      importedThrough: source.importedThrough?.toISOString() ?? null,
    });
}
try {
  const control = await db().workerControl.findUnique({
    where: { service: 'ecosystem' },
  });
  log('ecosystem.control', { mode: control?.mode ?? 'DISABLED' });
  await reportSources();
  await runWorker(
    'ecosystem',
    async (signal, mode) => {
      if (Date.now() >= nextSourcePoll) {
        await activityCycle(
          { maxPages: 2, workerMode: mode === 'LIVE' ? 'LIVE' : 'HISTORICAL' },
          () => signal.aborted,
        );
        nextSourcePoll = Date.now() + 300000;
        await reportSources();
      }
      if (!signal.aborted) {
        const result = await syncDripDue();
        if (result.status !== lastDripStatus || Date.now() >= nextDripReport) {
          log('drip.sync', {
            status: result.status,
            ...('balances' in result && typeof result.balances === 'number'
              ? { balances: result.balances }
              : {}),
          });
          lastDripStatus = result.status;
          nextDripReport = Date.now() + 60000;
        }
      }
      return {
        // Feed failures are isolated and retried on the next poll. Reserve the
        // worker circuit breaker for scheduler/database failures.
        sourceErrors: await db().integrationSource.count({
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
