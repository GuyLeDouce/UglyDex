import 'server-only';
import { Pool } from 'pg';
import { db } from './db';
import { launchContext, recordGate } from './launch';
import {
  semanticFingerprints,
  replayConfiguration,
  fingerprintDiff,
  type Fingerprints,
} from './replay-proof';
import { verifyDerived } from './derived-verification';
import { verifyProvenanceConvergence } from './provenance-convergence';
import { replayPolicy } from '@/domain/replay-policy';
import { hash } from '@/domain/events';
import { services, heartbeatState } from '@/domain/operations';
import { unavailableSource } from '@/integrations/availability';

// The frozen Phase 11 A/B predates configurationHash storage. This reviewed
// manifest binds its exact proof, input hash, ruleset hashes and semantic catalog
// hashes to the values captured in docs/phase11-reconciliation-replay-report.md.
// Advanced live input is accepted only while every ruleset/catalog fingerprint
// still matches this manifest. Future frozen proofs bind configurationHash
// directly and do not need a compatibility entry.
const reviewedLegacyProofs = new Map([
  [
    'b6a1d45d-d9fc-454a-9771-37da3cb450c1',
    {
      commit: 'cd15cd36c835be38b316ea7bd6fc9c45bab0f77f',
      inputHash:
        '83b5ec1c293e1452ee560ddd3afd35da72a6c2d61494b3273184d7419f7162f1',
      configuration: {
        ProgressionRuleset:
          '04eb87c3edd95874ec224949aabfd5d1a12231491e9f0cfa6d84425d56e8742f',
        CollectionRuleset:
          '8e4ddedf18fc7bb66ad37d0f76d8060e3a45ebacd403626849d353e60553d817',
        AchievementDefinition:
          '312fdb054f7d05f06642359c4f517b49ed118e2a559dcb934874670ad3c298af',
        CollectionSetDefinition:
          'a8960623ae7790457bce47270fe93cb405f072525d1635c73f145f09598732dd',
        CollectionSetRequirement:
          '312ac4a83d79b9dd7349b74888df2c70682db2e59b54e2a0e083a6ee591f3365',
        CosmeticDefinition:
          '37e415220c540864414a2399562c1b0c5784958e394f743e3b21e0ee47323a3c',
      },
    },
  ],
]);

/** Every read imports the same PostgreSQL MVCC snapshot. Engines issue no writes.
 * Workers may keep ingesting; this evidence describes capturedAt, never a later input.
 * Each launch verification captures a fresh boundary; no advanced hash is assumed safe.
 */
export async function verifyCurrentReplay() {
  const context = launchContext();
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1,
    connectionTimeoutMillis: 5000,
  });
  const client = await pool.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const boundary = (
      await client.query<{ snapshot: string; at: Date }>(
        'SELECT pg_export_snapshot() AS snapshot, transaction_timestamp() AS at',
      )
    ).rows[0];
    if (!/^[0-9A-Fa-f-]+$/.test(boundary.snapshot))
      throw new Error('INVALID_SNAPSHOT');
    const result = await db().$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
        await tx.$executeRawUnsafe(
          `SET TRANSACTION SNAPSHOT '${boundary.snapshot}'`,
        );
        const proof = await tx.replayProof.findFirst({
          orderBy: { startedAt: 'desc' },
        });
        const inputs = await semanticFingerprints(client, 'input', false);
        const derived = await semanticFingerprints(client, 'derived', false);
        const configuration = replayConfiguration(inputs),
          configurationHash = hash(configuration);
        const queues = {
          attribution: await tx.activityAttributionJob.count(),
          progression: await tx.progressionJob.count(),
          collections: await tx.collectionJob.count(),
          dirty: await tx.squigProvenance.count({ where: { dirty: true } }),
          failed:
            (await tx.progressionJob.count({
              where: { errorCode: { not: null } },
            })) +
            (await tx.collectionJob.count({
              where: { errorCode: { not: null } },
            })),
        };
        const controls = await tx.workerControl.findMany();
        const beats = await tx.workerHeartbeat.findMany({
          orderBy: { lastHeartbeat: 'desc' },
        });
        const workerBoundary = await Promise.all(
          services.map(async (service) => {
            if (
              controls.find((c) => c.service === service)?.mode === 'DISABLED'
            ) {
              // DISABLED is intent; an older cycle can still be draining. Hold its
              // normal worker lock until this read-only boundary has completed.
              const locks = await tx.$queryRaw<
                { acquired: boolean }[]
              >`SELECT pg_try_advisory_xact_lock(hashtextextended(${'worker:' + service},0)) AS acquired`;
              return {
                service,
                mode: 'QUIESCED',
                healthy: locks[0]?.acquired === true,
              };
            }
            const beat = beats.find((b) => b.service === service);
            return {
              service,
              mode: 'LIVE',
              healthy: Boolean(
                beat &&
                beat.lastSuccessAt &&
                !beat.errorCode &&
                +boundary.at - +beat.lastSuccessAt < 300000 &&
                ['IDLE', 'RUNNING', 'READY', 'LOCKED_BY_PEER'].includes(
                  heartbeatState(beat.lastHeartbeat, beat.state, boundary.at),
                ),
              ),
            };
          }),
        );
        const workersHealthy = workerBoundary.every((w) => w.healthy);
        const sources = await tx.integrationSource.findMany();
        const ingestionHealthy =
          workersHealthy &&
          !(await tx.importRejection.count({ where: { resolvedAt: null } })) &&
          sources.every(
            (s) =>
              unavailableSource(s) ||
              (s.schemaValid === true &&
                ![
                  'IMPORT_FAILED',
                  'ROLE_HAS_WRITE_PRIVILEGES',
                  'PERMISSIONS_UNAVAILABLE',
                ].includes(s.warning ?? '') &&
                !['ERROR', 'FAILED', 'DEGRADED', 'UNAVAILABLE'].includes(
                  s.state,
                )),
          );
        const legacy = proof ? reviewedLegacyProofs.get(proof.id) : undefined;
        const legacyConfigurationCompatible =
          !!legacy &&
          proof?.commit === legacy.commit &&
          proof.inputHash === legacy.inputHash &&
          Object.entries(legacy.configuration).every(
            ([name, fingerprint]) => inputs[name]?.sha256 === fingerprint,
          );
        const compatible =
          !!proof &&
          context.commit !== 'unknown' &&
          proof.environment === context.environment &&
          (proof.commit === context.commit || legacyConfigurationCompatible) &&
          (!proof.databaseFingerprint ||
            proof.databaseFingerprint === context.databaseFingerprint) &&
          (proof.configurationHash
            ? proof.configurationHash === configurationHash
            : legacyConfigurationCompatible);
        const frozenValid =
          !!proof?.finishedAt &&
          !!proof.inputHash &&
          !!proof.replayA &&
          !!proof.replayB &&
          !proof.errorCode &&
          !fingerprintDiff(
            proof.replayA as Fingerprints,
            proof.replayB as Fingerprints,
          ).length &&
          Array.isArray(proof.differences) &&
          proof.differences.length === 0;
        const exactInput = proof?.inputHash === hash(inputs),
          exactDerived =
            !!proof?.replayB &&
            !fingerprintDiff(proof.replayB as Fingerprints, derived).length;
        const state = {
          frozenStatus:
            proof?.status === 'VERIFIED' && !frozenValid
              ? 'FAILED'
              : (proof?.status ?? 'ABSENT'),
          compatible,
          exactInput,
          exactDerived,
          ...queues,
          ingestionHealthy,
          convergence: 'ABSENT' as 'ABSENT' | 'MATCH' | 'MISMATCH',
        };
        let checks: Awaited<ReturnType<typeof verifyDerived>> = [];
        // Legacy proofs cannot certify advanced configuration they never recorded.
        if (
          compatible &&
          frozenValid &&
          proof?.status === 'VERIFIED' &&
          (proof.configurationHash || legacyConfigurationCompatible) &&
          !Object.values(queues).some(Boolean) &&
          ingestionHealthy &&
          !(exactInput && exactDerived)
        ) {
          checks = [
            ...(await verifyProvenanceConvergence(tx)),
            ...(await verifyDerived(tx)),
          ];
          state.convergence = checks.some((c) => c.status === 'FAIL')
            ? 'MISMATCH'
            : 'MATCH';
        }
        return {
          proofId: proof?.id,
          inputs,
          derived,
          configuration,
          configurationHash,
          queues,
          workerBoundary,
          ingestionHealthy,
          checks,
          status: replayPolicy(state),
          capturedAt: boundary.at,
          convergence: state.convergence,
        };
      },
      { isolationLevel: 'RepeatableRead', timeout: 1800000, maxWait: 10000 },
    );
    await client.query('COMMIT');
    let liveProofId: string | undefined;
    if (result.proofId && result.convergence !== 'ABSENT') {
      const saved = await db().liveDerivationProof.create({
        data: {
          ...context,
          frozenProofId: result.proofId,
          capturedAt: result.capturedAt,
          status: result.status,
          inputHash: hash(result.inputs),
          inputs: result.inputs,
          derived: result.derived,
          configurationHash: result.configurationHash,
          configuration: result.configuration,
          queues: result.queues,
          checks: [
            ...result.checks,
            {
              name: 'ingestion.boundary',
              status: result.ingestionHealthy ? 'PASS' : 'FAIL',
              workers: result.workerBoundary,
            },
          ],
        },
      });
      liveProofId = saved.id;
    }
    await recordGate(
      'DERIVED_REPLAY_STABLE',
      result.status,
      result.status === 'VERIFIED'
        ? 'Frozen determinism and current snapshot convergence verified'
        : 'Current replay boundary requires review',
      {
        frozenProofId: result.proofId,
        liveProofId,
        capturedAt: result.capturedAt,
        inputHash: hash(result.inputs),
        configurationHash: result.configurationHash,
        queues: result.queues,
        workerBoundary: result.workerBoundary,
        ingestionHealthy: result.ingestionHealthy,
        checks: result.checks,
      },
    );
    return result.status === 'VERIFIED';
  } finally {
    await client.query('ROLLBACK').catch(() => {});
    client.release();
    await pool.end();
  }
}
