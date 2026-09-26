import { db } from '../../src/server/db';
import { replayProof, verifyReplayProof } from '../../src/server/replay-proof';
import { runWorker, setWorkerControl } from '../../src/server/worker-runtime';
import { writeFile } from 'node:fs/promises';
export async function phase9ReplayTests(
  check: (v: unknown, m: string) => void,
) {
  const commit = process.env.APP_COMMIT;
  process.env.APP_COMMIT = 'd'.repeat(40);
  try {
    await db().workerControl.updateMany({ data: { mode: 'DISABLED' } });
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
    const result = await replayProof();
    check(
      result.status === 'VERIFIED' && !result.differences.length,
      'complete Replay A/B stable on safe fixture database',
    );
    check(
      await verifyReplayProof(),
      'fresh input and derived fingerprints revalidate proof',
    );
    await writeFile(
      '.data/phase9-replay.json',
      JSON.stringify(result, null, 2),
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
