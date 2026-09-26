import 'server-only';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { db } from './db';
import { readEnv } from './env';
import { log } from './log';
import {
  backfillStages,
  services,
  safeOperationalCode,
  type BackfillStage,
  requirePassingGate,
} from '@/domain/operations';
import { chainKey, derivePending, seedAttributions } from '@/sync/provenance';
import { transferBatch } from '@/sync/transfers';
import { syncSquigs } from '@/sync/squigs';
import { syncIdentities } from '@/sync/run';
import { runActivityFeed } from '@/sync/activity';
import { feeds } from '@/sync/normalize';
import { integrationEnv, tables } from '@/integrations/registry';
import {
  seedProgression,
  queueReplay,
  processProgression,
} from './progression-engine';
import {
  seedCollections,
  queueCollections,
  processCollections,
} from './dex-engine';
import { migrationChecks } from './production';
import { assertOperation } from './deployment';
import { stageGate } from './stage-gates';

type BatchResult = {
  complete: boolean;
  counts: Record<string, number | string | boolean | null>;
};
export async function backfillBatch(
  stage: BackfillStage,
): Promise<BatchResult> {
  switch (stage) {
    case 'catalog': {
      const counts = await syncSquigs();
      if (counts.failed) throw new Error('CATALOG_ROWS_FAILED');
      await seedProgression();
      await seedCollections();
      const { seedCosmetics } = await import('./cosmetics');
      await seedCosmetics();
      return { complete: true, counts };
    }
    case 'transfers': {
      const worked = await transferBatch();
      if (worked === null) throw new Error('CHAIN_LOCK_BUSY');
      const cursor = await db().chainCursor.findUniqueOrThrow({
        where: { key: chainKey },
      });
      return {
        complete:
          cursor.finalizedBlock !== null &&
          cursor.blockNumber >= cursor.finalizedBlock,
        counts: {
          block: cursor.blockNumber.toString(),
          target: cursor.finalizedBlock?.toString() ?? null,
        },
      };
    }
    case 'provenance': {
      await seedAttributions();
      const derived = await derivePending(100);
      const pending = await db().squigProvenance.count({
        where: { dirty: true },
      });
      return { complete: pending === 0, counts: { derived, pending } };
    }
    case 'identity': {
      const counts = await syncIdentities();
      if (counts.failed) throw new Error('IDENTITY_IMPORT_FAILED');
      // Reconciliation records are deliberately not resolved by orchestration.
      const pending = await db().identityReconciliation.count({
        where: { status: 'PENDING' },
      });
      if (pending) throw new Error('IDENTITY_REVIEW_REQUIRED');
      await seedAttributions();
      const derived = await derivePending(100);
      return {
        complete: !(await db().squigProvenance.count({
          where: { dirty: true },
        })),
        counts: { ...counts, derived, pending },
      };
    }
    case 'activity': {
      const configured = feeds.filter(
        (f) => process.env[integrationEnv[tables[f].integration]],
      );
      let processed = 0;
      for (const feed of configured) {
        const source = await db().integrationSource.findUnique({
          where: { id: feed },
        });
        if (
          !source?.schemaValid ||
          source.warning === 'ROLE_HAS_WRITE_PRIVILEGES'
        )
          throw new Error('SOURCE_VALIDATION_REQUIRED');
        if (
          process.env.APP_ENV === 'production' ||
          process.env.APP_ENV === 'staging'
        ) {
          const approval = await db().operationalAudit.findFirst({
            where: { action: 'PILOT_APPROVED', subject: feed },
            orderBy: { createdAt: 'desc' },
          });
          const detail = approval?.detail as
            { schemaFingerprint?: string } | undefined;
          if (
            !approval ||
            detail?.schemaFingerprint !== source.schemaFingerprint
          )
            throw new Error('PILOT_REVIEW_REQUIRED');
        }
        if (!source.backfillFinishedAt) {
          const result = await runActivityFeed(feed, { maxPages: 2 });
          if (result.failed) throw new Error('ACTIVITY_ROWS_FAILED');
          processed += result.scanned;
          break; // one bounded feed batch; next invocation resumes its own cursor
        }
      }
      const pending = await db().integrationSource.count({
        where: { id: { in: configured }, backfillFinishedAt: null },
      });
      const { reattributePending } = await import('@/sync/import-event');
      await reattributePending();
      return {
        complete: pending === 0,
        counts: {
          processed,
          pending,
          configured: configured.length,
          historyUnavailable: configured.length === 0,
        },
      };
    }
    case 'progression': {
      const queued = !!(await queueReplay());
      const counts = await processProgression(50);
      if (counts.failed) throw new Error('PROGRESSION_BATCH_FAILED');
      const pending = await db().progressionJob.count();
      return {
        complete: queued && pending === 0,
        counts: { ...counts, pending },
      };
    }
    case 'collections': {
      const queued = !!(await queueCollections());
      const counts = await processCollections(25);
      if (counts.failed) throw new Error('COLLECTION_BATCH_FAILED');
      const pending = await db().collectionJob.count();
      return {
        complete: queued && pending === 0,
        counts: { ...counts, pending },
      };
    }
    case 'verification': {
      const { productionVerify } = await import('./production-verify');
      const checks = await productionVerify();
      if (checks.some((c) => c.status === 'FAIL'))
        throw new Error('VERIFICATION_DISCREPANCIES');
      return {
        complete: true,
        counts: {
          checks: checks.length,
          warnings: checks.filter((c) => c.status === 'WARN').length,
        },
      };
    }
  }
}

export async function productionBackfill(
  options: {
    from?: BackfillStage;
    batches?: number;
    signal?: AbortSignal;
    runner?: typeof backfillBatch;
    acceptedWarnings?: string[];
  } = {},
) {
  await assertOperation('backfill');
  if ((await migrationChecks()).some((c) => c.status === 'FAIL'))
    throw new Error('MIGRATIONS_NOT_READY');
  const pool = new Pool({
    connectionString: readEnv().DATABASE_URL,
    max: 1,
    connectionTimeoutMillis: 5000,
  });
  const client = await pool.connect();
  let lostLock = false;
  const lockFailure = () => {
    lostLock = true;
  };
  client.on('error', lockFailure);
  const runId = randomUUID();
  try {
    if (
      !(
        await client.query<{ acquired: boolean }>(
          "SELECT pg_try_advisory_lock(hashtextextended('production:backfill',0)) AS acquired",
        )
      ).rows[0].acquired
    )
      throw new Error('BACKFILL_LOCK_BUSY');
    // Explicit backfills are sequential; background derivation must be disabled for a stable replay.
    if (
      await db().workerControl.count({ where: { mode: { not: 'DISABLED' } } })
    )
      throw new Error('DISABLE_WORKERS_BEFORE_BACKFILL');
    // Disabling is asynchronous: also require any in-flight worker task to drain.
    for (const service of services) {
      const lock = await client.query<{ acquired: boolean }>(
        'SELECT pg_try_advisory_lock(hashtextextended($1,0)) AS acquired',
        [`worker:${service}`],
      );
      if (!lock.rows[0].acquired) throw new Error('WORKER_TASK_STILL_RUNNING');
    }
    const from = options.from ? backfillStages.indexOf(options.from) : 0;
    for (const previous of backfillStages.slice(0, from)) {
      if (
        !(await db().productionStage.findUnique({ where: { stage: previous } }))
          ?.completedAt
      )
        throw new Error('EARLIER_STAGE_INCOMPLETE');
      if (!options.runner)
        requirePassingGate(await stageGate(previous), options.acceptedWarnings);
    }
    let batches = 0;
    for (const stage of backfillStages.slice(from)) {
      const prior = await db().productionStage.findUnique({ where: { stage } });
      if (prior?.completedAt) {
        if (!options.runner) {
          const checks = await stageGate(stage);
          if (checks.some((c) => c.status === 'FAIL'))
            throw new Error('COMPLETED_STAGE_NO_LONGER_VALID');
          if (
            checks.some(
              (c) =>
                c.status === 'WARN' &&
                !options.acceptedWarnings?.includes(c.name),
            )
          )
            throw new Error('STAGE_WARNING_REVIEW_REQUIRED');
        }
        continue;
      }
      while (
        batches < (options.batches ?? 20) &&
        !options.signal?.aborted &&
        !lostLock
      ) {
        const start = Date.now();
        await db().productionStage.upsert({
          where: { stage },
          create: {
            stage,
            runId,
            status: 'RUNNING',
            attempts: 1,
            startedAt: new Date(),
          },
          update: {
            runId,
            status: 'RUNNING',
            attempts: { increment: 1 },
            errorCode: null,
            startedAt: new Date(),
          },
        });
        try {
          const result = await (options.runner ?? backfillBatch)(stage);
          if (result.complete && !options.runner) {
            const gates = await stageGate(stage);
            await db().operationalAudit.create({
              data: {
                actor: 'backfill',
                action: 'STAGE_GATE',
                subject: stage,
                detail: gates,
              },
            });
            requirePassingGate(gates, options.acceptedWarnings);
          }
          await db().productionStage.update({
            where: { stage },
            data: {
              status: result.complete ? 'COMPLETED' : 'PAUSED',
              counts: result.counts,
              completedAt: result.complete ? new Date() : null,
            },
          });
          log('production.batch', {
            runId,
            service: 'backfill',
            stage,
            durationMs: Date.now() - start,
            success: true,
            ...result.counts,
          });
          batches++;
          if (result.complete) break;
        } catch (error) {
          const code = safeOperationalCode(error);
          await db().productionStage.update({
            where: { stage },
            data: { status: 'FAILED', errorCode: code },
          });
          log('production.batch', {
            runId,
            service: 'backfill',
            stage,
            durationMs: Date.now() - start,
            success: false,
            code,
          });
          throw error;
        }
      }
      if (
        batches >= (options.batches ?? 20) ||
        options.signal?.aborted ||
        lostLock
      )
        break;
    }
    if (lostLock) throw new Error('BACKFILL_LOCK_LOST');
    return db().productionStage.findMany({ orderBy: { startedAt: 'asc' } });
  } finally {
    await client.query('SELECT pg_advisory_unlock_all()').catch(() => {});
    client.removeListener('error', lockFailure);
    client.release();
    await pool.end();
  }
}
