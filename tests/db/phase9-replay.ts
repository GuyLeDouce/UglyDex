import { db } from '../../src/server/db';
import { replayProof, verifyReplayProof } from '../../src/server/replay-proof';
import { runWorker, setWorkerControl } from '../../src/server/worker-runtime';
import { writeFile } from 'node:fs/promises';
import { hash } from '../../src/domain/events';
import { processProgression } from '../../src/server/progression-engine';
import { processCollections } from '../../src/server/dex-engine';
import { reattributePending } from '../../src/sync/import-event';
import { deriveToken } from '../../src/sync/provenance';
import { services } from '../../src/domain/operations';
export async function phase9ReplayTests(
  check: (v: unknown, m: string) => void,
) {
  const commit = process.env.APP_COMMIT;
  process.env.APP_COMMIT = 'd'.repeat(40);
  try {
    await db().workerControl.updateMany({ data: { mode: 'DISABLED' } });
    for (const service of services)
      await setWorkerControl({ service, mode: 'DISABLED' }, 'fixture');
    await db().editionContract.updateMany({ data: { enabled: false } });
    // Real worker runtime with local injected task failures. Never contacts an upstream source.
    for (const service of ['progression', 'collections'] as const) {
      await setWorkerControl({ service, mode: 'HISTORICAL' }, 'fixture');
      await runWorker(
        service,
        async () => {
          throw new Error('SIMULATED_OUTAGE');
        },
        { once: true },
      );
      const failed = await db().workerHeartbeat.findFirst({
        where: { service },
        orderBy: { lastHeartbeat: 'desc' },
      });
      check(
        failed?.errorCode === 'SIMULATED_OUTAGE',
        'worker failure persists safe error ' + service,
      );
      await runWorker(service, async () => ({ processed: 1 }), { once: true });
      const recovered = await db().workerHeartbeat.findFirst({
        where: { service },
        orderBy: { lastHeartbeat: 'desc' },
      });
      check(
        !!recovered?.lastSuccessAt && !recovered.errorCode,
        'restart recovers successful task ' + service,
      );
      await setWorkerControl({ service, mode: 'DISABLED' }, 'fixture');
    }
    // Prior phases intentionally leave source outages and rejected fixtures.
    // Resolve those test scenarios before freezing a healthy proof boundary.
    await db().integrationSource.updateMany({
      data: { schemaValid: true, state: 'LIVE', warning: null },
    });
    await db().importRejection.updateMany({ data: { resolvedAt: new Date() } });
    // Earlier presentation fixtures contain deliberately synthetic clean
    // projections. Build a genuine engine-derived baseline before freezing it.
    for (const row of await db().squigProvenance.findMany({
      select: { squigId: true },
    }))
      await deriveToken(row.squigId);
    const result = await replayProof();
    check(
      result.status === 'VERIFIED' && !result.differences.length,
      'complete Replay A/B stable on safe fixture database',
    );
    const exactVerified = await verifyReplayProof();
    if (!exactVerified) {
      const gate = await db().launchGate.findUnique({
        where: { key: 'DERIVED_REPLAY_STABLE' },
      });
      console.log(
        JSON.stringify({
          event: 'test.replay_boundary_failed',
          status: gate?.status,
          notes: gate?.notes,
        }),
      );
      console.log(
        JSON.stringify({
          event: 'test.replay_prerequisites',
          dirty: await db().squigProvenance.count({ where: { dirty: true } }),
          rejections: await db().importRejection.count({
            where: { resolvedAt: null },
          }),
          controls: await db().workerControl.findMany({
            select: { service: true, mode: true },
          }),
        }),
      );
    }
    check(
      exactVerified,
      'fresh input and derived fingerprints revalidate proof',
    );
    await writeFile(
      '.data/phase9-replay.json',
      JSON.stringify(result, null, 2),
    );
    const source = await db().integrationSource.findFirstOrThrow();
    await db().integrationSource.update({
      where: { id: source.id },
      data: { lastAttemptAt: new Date() },
    });
    check(
      await verifyReplayProof(),
      'excluded source polling clock leaves frozen semantic input unchanged',
    );
    const frozen = await db().replayProof.findUniqueOrThrow({
      where: { id: result.id },
    });
    const activity = await db().collectorActivity.findFirstOrThrow({
      where: {
        sourceSystem: { not: 'provenance' },
        collectorId: { not: null },
      },
    });
    await db().collectorActivity.update({
      where: { id: activity.id },
      data: {
        sourceUpdatedAt: new Date(),
        payloadHash: hash(['fixture-live-correction', activity.payloadHash]),
      },
    });
    if (activity.collectorId)
      await db().progressionJob.upsert({
        where: {
          subjectType_subjectId: {
            subjectType: 'COLLECTOR',
            subjectId: activity.collectorId,
          },
        },
        create: { subjectType: 'COLLECTOR', subjectId: activity.collectorId },
        update: { generation: { increment: 1 }, errorCode: null },
      });
    check(
      !(await verifyReplayProof()),
      'semantic source correction requires current convergence or queue drain',
    );
    await reattributePending();
    for (let n = 0; await db().progressionJob.count(); n++) {
      check(n < 500, 'live progression drain remains bounded');
      check(
        !(await processProgression(50)).failed,
        'live correction progression evaluation succeeds',
      );
    }
    for (let n = 0; await db().collectionJob.count(); n++) {
      check(n < 500, 'live collection drain remains bounded');
      check(
        !(await processCollections()).failed,
        'live correction collection evaluation succeeds',
      );
    }
    // Fixture-only source validation: the prior phases deliberately exercised source
    // outages and rejected input. Recompute proof needs the same reviewed prerequisites
    // as staging, not those historical failure scenarios left unresolved.
    await db().integrationSource.updateMany({
      data: { schemaValid: true, state: 'LIVE', warning: null },
    });
    await db().importRejection.updateMany({ data: { resolvedAt: new Date() } });
    const advancedVerified = await verifyReplayProof();
    if (!advancedVerified) {
      const latest = await db().liveDerivationProof.findFirst({
        orderBy: { capturedAt: 'desc' },
      });
      console.log(
        JSON.stringify({
          event: 'test.live_convergence_failed',
          status: latest?.status,
          queues: latest?.queues,
          checks: latest?.checks,
        }),
      );
    }
    check(
      advancedVerified,
      'advanced real semantic input plus read-only convergence verifies',
    );
    const live = await db().liveDerivationProof.findFirstOrThrow({
      orderBy: { capturedAt: 'desc' },
    });
    check(
      live.frozenProofId === result.id &&
        live.inputHash !== result.inputHash &&
        live.status === 'VERIFIED',
      'live convergence evidence independently binds its advanced input boundary',
    );
    check(
      hash(
        await db().replayProof.findUniqueOrThrow({ where: { id: result.id } }),
      ) === hash(frozen),
      'live verification preserves the immutable historical frozen proof',
    );
    const progress = await db().collectorProgress.findFirstOrThrow();
    await db().collectorProgress.update({
      where: { collectorId: progress.collectorId },
      data: { xp: { increment: 1 } },
    });
    check(
      !(await verifyReplayProof()),
      'semantic tampering invalidates launch proof',
    );
    await db().collectorProgress.update({
      where: { collectorId: progress.collectorId },
      data: { xp: progress.xp },
    });
  } finally {
    if (commit === undefined) delete process.env.APP_COMMIT;
    else process.env.APP_COMMIT = commit;
  }
}
