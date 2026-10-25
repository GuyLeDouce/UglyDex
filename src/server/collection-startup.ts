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
  let queued = false;
  do {
    if (signal.aborted) return;
    queued = !!(await queueCollections(false, replayId));
    // Small batches yield between transactions; interrupted jobs remain durable.
    const counts = await processCollections(10, () => signal.aborted);
    const progression = await processProgression(
      10,
      () => signal.aborted,
      'COLLECTOR',
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
    if (
      counts.failed ||
      counts.deferred ||
      progression.failed ||
      progression.deferred
    )
      throw new Error('COLLECTION_STARTUP_RETRY');
  } while (
    !queued ||
    (await db().collectionJob.count()) > 0 ||
    (await db().progressionJob.count({ where: { subjectType: 'COLLECTOR' } })) >
      0
  );
  console.log(
    JSON.stringify({ event: 'collections.startup_complete', replayId }),
  );
}
