import 'server-only';
import { db } from './db';
import { type BackfillStage, type Check } from '@/domain/operations';
import { chainKey } from '@/sync/provenance';
export async function stageGate(stage: BackfillStage): Promise<Check[]> {
  const check = (name: string, n: number, detail: string): Check => ({
    name,
    status: n ? 'FAIL' : 'PASS',
    detail: `${n}; ${detail}`,
  });
  if (stage === 'catalog')
    return [
      check(
        'catalog.count',
        Math.abs(4444 - (await db().squig.count())),
        'Catalog requires 4444',
      ),
    ];
  if (stage === 'transfers') {
    const c = await db().chainCursor.findUnique({ where: { key: chainKey } });
    return [
      check(
        'chain.coverage',
        !c ||
          c.lastError ||
          c.finalizedBlock === null ||
          c.blockNumber < c.finalizedBlock
          ? 1
          : 0,
        'Finalized coverage and error-free cursor required',
      ),
    ];
  }
  if (stage === 'provenance')
    return [
      check(
        'provenance.continuity',
        await db().squigProvenance.count({
          where: { OR: [{ dirty: true }, { complete: false }] },
        }),
        'No dirty/incomplete token history',
      ),
      check(
        'provenance.catalog',
        Math.abs(4444 - (await db().squigProvenance.count())),
        'Every Reloaded token requires provenance',
      ),
    ];
  if (stage === 'identity')
    return [
      check(
        'identity.review',
        await db().identityReconciliation.count({
          where: { status: 'PENDING' },
        }),
        'Unresolved review cases',
      ),
    ];
  if (stage === 'activity') {
    const sources = await db().integrationSource.findMany();
    return [
      check(
        'activity.rejections',
        await db().importRejection.count({ where: { resolvedAt: null } }),
        'Rejected rows require review',
      ),
      {
        name: 'activity.coverage',
        status:
          sources.length &&
          sources.every(
            (s) => s.backfillFinishedAt && s.schemaValid && s.state !== 'ERROR',
          )
            ? 'PASS'
            : 'WARN',
        detail:
          'Missing or incomplete legacy sources remain unavailable; explicit warning acceptance preserves this limitation',
      },
    ];
  }
  if (stage === 'progression')
    return [
      check(
        'progression.queue',
        await db().progressionJob.count(),
        'Queue must drain',
      ),
    ];
  if (stage === 'collections')
    return [
      check(
        'collections.queue',
        await db().collectionJob.count(),
        'Queue must drain',
      ),
    ];
  const { productionVerify } = await import('./production-verify');
  return productionVerify();
}
