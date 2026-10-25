import { setTimeout as delay } from 'node:timers/promises';
import 'server-only';
import { createHash } from 'node:crypto';
import { COLLECTION_RULESET } from '@/domain/dex';
import { assertDeploymentBinding } from './deployment';
import { db } from './db';
import { seedProgression, processProgression } from './progression-engine';
import {
  seedCollections,
  queueCollections,
  processCollections,
} from './dex-engine';

export function startupReplayId(
  env: Record<string, string | undefined> = process.env,
) {
  // Replicas share a checkpoint. A restart resumes; a new deployment revisits everyone.
  const revision =
    env.RAILWAY_DEPLOYMENT_ID ||
    env.RAILWAY_GIT_COMMIT_SHA ||
    env.DEPLOYMENT_REVISION ||
    COLLECTION_RULESET;
  return `startup:${COLLECTION_RULESET}:${createHash('sha256').update(revision).digest('hex').slice(0, 24)}`;
}

export async function recalculateOnStartup(signal: AbortSignal) {
  await assertDeploymentBinding();
  await seedCollections();
  await seedProgression();
  const replayId = startupReplayId();
  let queued = false,
    stalled = 0;
  const maxAttempts = 3;
  do {
    if (signal.aborted) return;
    queued = !!(await queueCollections(false, replayId));
    // Small batches yield between transactions; interrupted jobs remain durable.
    const counts = await processCollections(
      10,
      () => signal.aborted,
      maxAttempts,
    );
    const progression = await processProgression(
      10,
      () => signal.aborted,
      'COLLECTOR',
      maxAttempts,
    );
    console.log(
      JSON.stringify({
        event: 'collections.startup_batch',
        replayId,
        queued,
        ...counts,
        progression,
      }),
    );
    if (signal.aborted) return;
    const [
      pendingCollections,
      pendingProgression,
      allCollections,
      allProgression,
    ] = await Promise.all([
      db().collectionJob.count({
        where: { OR: [{ errorCode: null }, { attempts: { lt: maxAttempts } }] },
      }),
      db().progressionJob.count({
        where: {
          subjectType: 'COLLECTOR',
          OR: [{ errorCode: null }, { attempts: { lt: maxAttempts } }],
        },
      }),
      db().collectionJob.count(),
      db().progressionJob.count({ where: { subjectType: 'COLLECTOR' } }),
    ]);
    if (queued && !pendingCollections && !pendingProgression) {
      if (allCollections || allProgression) {
        console.error(
          JSON.stringify({
            event: 'collections.startup_blocked',
            replayId,
            collections: allCollections,
            progression: allProgression,
            code: 'COLLECTION_STARTUP_BLOCKED',
          }),
        );
        throw new Error('COLLECTION_STARTUP_BLOCKED');
      }
      break;
    }
    // One troublesome profile must not abort the healthy queue. Conflicts are
    // retried separately with backoff, rather than spending the global budget.
    const conflicts = counts.deferred + progression.deferred;
    stalled =
      queued &&
      !counts.processed &&
      !progression.processed &&
      !counts.failed &&
      !progression.failed
        ? stalled + 1
        : 0;
    if (stalled >= 5) throw new Error('COLLECTION_STARTUP_STALLED');
    if (conflicts || counts.failed || progression.failed) {
      await delay(Math.min(10000, 1000 * 2 ** stalled), undefined, {
        signal,
      }).catch(() => {});
    }
  } while (!signal.aborted);
  if (signal.aborted) return;
  console.log(
    JSON.stringify({ event: 'collections.startup_complete', replayId }),
  );
}
