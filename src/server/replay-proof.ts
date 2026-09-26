import 'server-only';
import { createHash } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { db } from './db';
import { assertOperation } from './deployment';
import { recordGate, launchContext } from './launch';
import { services, safeOperationalCode } from '@/domain/operations';
import { hash } from '@/domain/events';
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
import { reattributePending } from '@/sync/import-event';
import { seedCosmetics } from './cosmetics';
import { chainKey } from '@/sync/provenance';
import { log } from './log';
// Only processing clocks are excluded. Award, acquisition, revocation and milestone dates remain semantic.
const derived = {
  CollectorProgress: ['calculatedAt'],
  SquigProgress: ['calculatedAt'],
  XpLedgerEntry: ['createdAt'],
  CollectorAchievement: ['evaluatedAt'],
  SquigAchievement: ['evaluatedAt'],
  ProgressionMilestone: [],
  SquigDiscovery: ['id'],
  CollectorTraitDiscovery: [],
  CollectorSetProgress: ['calculatedAt'],
  CollectionSnapshot: ['calculatedAt'],
  CollectionMilestone: [],
} as const;
const inputs = {
  Collector: ['updatedAt'],
  ExternalIdentity: ['updatedAt'],
  CollectorWallet: ['updatedAt'],
  HistoricalIdentityAttribution: ['createdAt', 'reviewedAt'],
  CollectorOwnershipPeriod: [],
  NftTransfer: ['indexedAt'],
  SquigProvenance: ['updatedAt', 'verifiedAt'],
  SquigOwnership: [],
  Squig: ['updatedAt'],
  SquigTrait: [],
  CollectorActivity: ['importedAt', 'updatedAt'],
  IntegrationSource: ['updatedAt', 'lastAttemptAt', 'lastSuccessAt'],
  ProgressionRuleset: ['createdAt'],
  CollectionRuleset: ['createdAt'],
  AchievementDefinition: [],
  CollectionSetDefinition: [],
  CollectionSetRequirement: [],
  CosmeticDefinition: [],
  CollectorCosmeticPreference: ['updatedAt'],
} as const;
export type Fingerprints = Record<string, { count: number; sha256: string }>;
export async function semanticFingerprints(
  client: PoolClient,
  mode: 'input' | 'derived',
): Promise<Fingerprints> {
  const results: Fingerprints = {};
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  try {
    for (const [table, omit] of Object.entries(
      mode === 'input' ? inputs : derived,
    )) {
      // Table/column names are static code-owned constants. Sorted JSONB normalizes key order.
      await client.query(
        `DECLARE semantic_rows NO SCROLL CURSOR FOR SELECT (to_jsonb(t) - $1::text[])::text AS row FROM "${table}" t ORDER BY (to_jsonb(t) - $1::text[])::text`,
        [omit],
      );
      const digest = createHash('sha256');
      let count = 0;
      for (;;) {
        const batch = await client.query<{ row: string }>(
          'FETCH 1000 FROM semantic_rows',
        );
        if (!batch.rows.length) break;
        for (const row of batch.rows) {
          digest.update(row.row + '\n');
          count++;
        }
      }
      await client.query('CLOSE semantic_rows');
      results[table] = { count, sha256: digest.digest('hex') };
    }
    await client.query('COMMIT');
    return results;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  }
}
export function fingerprintDiff(a: Fingerprints, b: Fingerprints) {
  return [...new Set([...Object.keys(a), ...Object.keys(b)])]
    .sort()
    .filter(
      (k) => a[k]?.sha256 !== b[k]?.sha256 || a[k]?.count !== b[k]?.count,
    );
}
export async function verifyReplayProof() {
  const proof = await db().replayProof.findFirst({
    orderBy: { startedAt: 'desc' },
  });
  if (!proof) {
    await recordGate(
      'DERIVED_REPLAY_STABLE',
      'PENDING',
      'No completed replay proof exists',
      {},
    );
    return false;
  }
  if (proof.status !== 'VERIFIED') {
    await recordGate(
      'DERIVED_REPLAY_STABLE',
      proof.status === 'FAILED' ? 'FAILED' : 'PENDING',
      'Latest replay has not produced a stable proof',
      { id: proof.id, status: proof.status },
    );
    return false;
  }
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1,
    connectionTimeoutMillis: 5000,
  });
  const client = await pool.connect();
  try {
    const context = launchContext();
    const valid =
      proof.environment === context.environment &&
      proof.commit === context.commit &&
      hash(await semanticFingerprints(client, 'input')) === proof.inputHash &&
      fingerprintDiff(
        proof.replayB as Fingerprints,
        await semanticFingerprints(client, 'derived'),
      ).length === 0;
    if (!valid)
      await recordGate(
        'DERIVED_REPLAY_STABLE',
        'PENDING',
        'Evidence changed since Replay A/B; rerun against stable inputs',
        { id: proof.id },
      );
    return valid;
  } finally {
    client.release();
    await pool.end();
  }
}
async function replay(label: 'A' | 'B') {
  const started = Date.now();
  log('launch.replay', { stage: label, service: 'replay', status: 'STARTED' });
  await reattributePending();
  await queueReplay(true);
  while (!(await queueReplay())) {}
  while (await db().progressionJob.count({ where: { errorCode: null } })) {
    if ((await processProgression(50)).failed)
      throw new Error('PROGRESSION_REPLAY_FAILED');
  }
  if (await db().progressionJob.count())
    throw new Error('PROGRESSION_JOBS_REMAIN');
  log('launch.replay', {
    stage: label,
    service: 'progression',
    status: 'COMPLETE',
    durationMs: Date.now() - started,
  });
  await queueCollections(true);
  while (!(await queueCollections())) {}
  while (await db().collectionJob.count({ where: { errorCode: null } })) {
    if ((await processCollections()).failed)
      throw new Error('COLLECTION_REPLAY_FAILED');
  }
  if (
    (await db().collectionJob.count()) ||
    (await db().activityAttributionJob.count())
  )
    throw new Error('ATTRIBUTION_OR_COLLECTION_JOBS_REMAIN');
  log('launch.replay', {
    stage: label,
    service: 'collections',
    status: 'COMPLETE',
    durationMs: Date.now() - started,
    rssBytes: process.memoryUsage().rss,
  });
}
export async function replayProof() {
  await assertOperation('replay');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1,
    connectionTimeoutMillis: 5000,
  });
  const client = await pool.connect();
  let lost = false;
  client.on('error', () => {
    lost = true;
  });
  let id: string | undefined;
  try {
    if (
      (await db().workerControl.count({
        where: { mode: { not: 'DISABLED' } },
      })) ||
      (await db().editionContract.count({ where: { enabled: true } }))
    )
      throw new Error('DISABLE_WORKERS_BEFORE_REPLAY');
    for (const key of [
      'production:backfill',
      chainKey,
      ...services.map((s) => `worker:${s}`),
    ]) {
      if (
        !(
          await client.query<{ ok: boolean }>(
            'SELECT pg_try_advisory_lock(hashtextextended($1,0)) AS ok',
            [key],
          )
        ).rows[0].ok
      )
        throw new Error('REPLAY_LOCK_BUSY');
    }
    await seedProgression();
    await seedCollections();
    await seedCosmetics();
    await reattributePending();
    const context = launchContext();
    // An interrupted older run is not a successful proof.
    await db().replayProof.updateMany({
      where: { status: 'RUNNING' },
      data: {
        status: 'INTERRUPTED',
        finishedAt: new Date(),
        errorCode: 'RESTART_REQUIRED',
      },
    });
    const run = await db().replayProof.create({
      data: { environment: context.environment, commit: context.commit },
    });
    id = run.id;
    await recordGate(
      'DERIVED_REPLAY_STABLE',
      'PENDING',
      'Replay A/B in progress',
      { id },
    );
    const input = await semanticFingerprints(client, 'input');
    await replay('A');
    const a = await semanticFingerprints(client, 'derived');
    await db().replayProof.update({
      where: { id },
      data: { inputHash: hash(input), replayA: a },
    });
    const middle = await semanticFingerprints(client, 'input');
    await replay('B');
    const b = await semanticFingerprints(client, 'derived');
    const end = await semanticFingerprints(client, 'input');
    const differences = fingerprintDiff(a, b);
    const changed =
      fingerprintDiff(input, middle).length ||
      fingerprintDiff(input, end).length;
    if (lost) throw new Error('REPLAY_LOCK_LOST');
    const stable = !changed && !differences.length;
    await db().replayProof.update({
      where: { id },
      data: {
        replayB: b,
        differences,
        status: stable ? 'VERIFIED' : 'FAILED',
        finishedAt: new Date(),
        errorCode: changed
          ? 'INPUTS_CHANGED'
          : differences.length
            ? 'SEMANTIC_DIFFERENCE'
            : null,
      },
    });
    await recordGate(
      'DERIVED_REPLAY_STABLE',
      stable ? 'VERIFIED' : 'FAILED',
      stable
        ? 'Replay A/B semantic hashes match with stable inputs'
        : 'Replay inputs or semantic outputs changed',
      { id, input: hash(input), a, b, differences },
    );
    if (stable)
      for (const key of [
        'PROGRESSION',
        'COLLECTIONS',
        'REATTRIBUTION',
      ] as const)
        await recordGate(
          key,
          'VERIFIED',
          'Completed Replay A/B; tracked evidence only',
          { id, input: hash(input) },
        );
    if (!stable) throw new Error('REPLAY_UNSTABLE');
    return {
      id,
      status: 'VERIFIED',
      inputHash: hash(input),
      replayA: a,
      replayB: b,
      differences,
    };
  } catch (e) {
    if (id) {
      await db().replayProof.update({
        where: { id },
        data: {
          status: 'FAILED',
          finishedAt: new Date(),
          errorCode: safeOperationalCode(e),
        },
      });
      await recordGate(
        'DERIVED_REPLAY_STABLE',
        'FAILED',
        'Replay failed; preserved checkpoints require review',
        { id, code: safeOperationalCode(e) },
      );
    }
    throw e;
  } finally {
    await client.query('SELECT pg_advisory_unlock_all()').catch(() => {});
    client.release();
    await pool.end();
  }
}
