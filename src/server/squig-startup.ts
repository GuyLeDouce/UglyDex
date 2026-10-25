import 'server-only';
import { setTimeout as delay } from 'node:timers/promises';
import { db } from './db';
import { deriveToken } from '@/sync/provenance';
import { processProgression } from './progression-engine';
import { recalculationErrorCode } from './recalculation-error';

// Uses only the existing ledger. Never scans RPC or invents missing mint evidence.
// Dirty rows and queued achievements are durable across interrupted deployments.
export async function recalculateSquigsOnStartup(signal: AbortSignal) {
  const failed = new Map<string, number>();
  let stalled = 0;
  while (!signal.aborted) {
    const excluded = [...failed]
      .filter(([, attempts]) => attempts >= 3)
      .map(([id]) => id);
    const rows = await db().squigProvenance.findMany({
      where: {
        dirty: true,
        ...(excluded.length ? { squigId: { notIn: excluded } } : {}),
      },
      select: { squigId: true },
      orderBy: { squigId: 'asc' },
      take: 10,
    });
    let derived = 0;
    for (const row of rows) {
      if (signal.aborted) return;
      try {
        await deriveToken(row.squigId);
        derived++;
      } catch (error) {
        failed.set(row.squigId, (failed.get(row.squigId) ?? 0) + 1);
        console.error(
          JSON.stringify({
            event: 'squigs.startup_provenance_failed',
            squigId: row.squigId,
            code: recalculationErrorCode(error),
          }),
        );
      }
    }
    if (signal.aborted) return;
    const progression = await processProgression(
      10,
      () => signal.aborted,
      'SQUIG',
      3,
    );
    if (signal.aborted) return;
    const [dirty, queued, runnable] = await Promise.all([
      db().squigProvenance.count({ where: { dirty: true } }),
      db().progressionJob.count({ where: { subjectType: 'SQUIG' } }),
      db().progressionJob.count({
        where: {
          subjectType: 'SQUIG',
          OR: [{ errorCode: null }, { attempts: { lt: 3 } }],
        },
      }),
    ]);
    console.log(
      JSON.stringify({
        event: 'squigs.startup_batch',
        derived,
        dirty,
        queued,
        progression,
      }),
    );
    if (!dirty && !queued) return;
    if (!rows.length && !runnable) throw new Error('SQUIG_STARTUP_BLOCKED');
    stalled =
      !derived && !progression.processed && !progression.failed && !rows.length
        ? stalled + 1
        : 0;
    if (stalled >= 5) throw new Error('SQUIG_STARTUP_STALLED');
    if (derived < rows.length || progression.failed || progression.deferred)
      await delay(Math.min(10000, 1000 * 2 ** stalled), undefined, {
        signal,
      }).catch(() => {});
  }
}
