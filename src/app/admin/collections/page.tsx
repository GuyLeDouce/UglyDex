import { RULESET as PROGRESSION_RULESET } from '@/domain/progression';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { adminActor } from '@/server/admin';
import { db } from '@/server/db';
import { COLLECTION_RULESET as R } from '@/domain/dex';
import {
  collectionSets,
  traitCatalog,
  requirementLabel,
} from '@/domain/dex-catalog';
import { dexView } from '@/server/dex';
import type { SearchParams } from '@/components/catalog';
export const dynamic = 'force-dynamic';
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  if (!(await adminActor())) notFound();
  const p = await searchParams,
    id = z.uuid().safeParse(p.collector),
    key = typeof p.set === 'string' ? p.set : undefined;
  const [ruleset, collectors, traits, completed, current, jobs, runs, replay] =
    await Promise.all([
      db().collectionRuleset.findUnique({ where: { id: R } }),
      db().collectionSnapshot.count({ where: { ruleset: R } }),
      db().collectorTraitDiscovery.count({
        where: { ruleset: R, revokedAt: null },
      }),
      db().collectorSetProgress.count({
        where: {
          currentlyComplete: true,
          set: { ruleset: R, mode: 'HISTORICAL_DISCOVERY' },
        },
      }),
      db().collectorSetProgress.count({
        where: {
          currentlyComplete: true,
          set: { ruleset: R, mode: 'CURRENT_HOLDING' },
        },
      }),
      db().collectionJob.findMany({
        orderBy: [{ attempts: 'desc' }, { queuedAt: 'asc' }],
        take: 25,
      }),
      db().syncRun.findMany({
        where: { source: `collections:${R}` },
        orderBy: { startedAt: 'desc' },
        take: 20,
      }),
      db().collectionReplay.findUnique({ where: { id: R } }),
    ]);
  const [
    startupReplays,
    achievementJobs,
    achievementRuns,
    collectionFailures,
    achievementFailures,
  ] = await Promise.all([
    db().collectionReplay.findMany({
      where: { id: { startsWith: 'startup:' } },
      orderBy: { updatedAt: 'desc' },
      take: 5,
    }),
    db().progressionJob.findMany({
      where: { subjectType: 'COLLECTOR' },
      orderBy: { queuedAt: 'asc' },
      take: 25,
    }),
    db().syncRun.findMany({
      where: {
        source: `progression:${PROGRESSION_RULESET}`,
        status: { in: ['FAILED', 'INTERRUPTED'] },
      },
      orderBy: { startedAt: 'desc' },
      take: 20,
    }),
    db().collectionJob.count({ where: { errorCode: { not: null } } }),
    db().progressionJob.count({
      where: { subjectType: 'COLLECTOR', errorCode: { not: null } },
    }),
  ]);
  const view = id.success ? await dexView(id.data) : null;
  const evidence = id.success
    ? await db().collectorSetProgress.findMany({
        where: {
          collectorId: id.data,
          set: { ruleset: R },
          ...(key ? { setId: `${R}:${key}` } : {}),
        },
        take: 52,
      })
    : [];
  const audit = id.success
    ? await db().collectionAudit.findMany({
        where: { collectorId: id.data, ruleset: R },
        orderBy: { createdAt: 'desc' },
        take: 30,
      })
    : [];
  return (
    <>
      <section className="page-heading">
        <p className="eyebrow">INTERNAL · COLLECTION EVIDENCE</p>
        <h1>Collection diagnostics.</h1>
        <Link href="/admin/collectors">
          Check and repair holder discovery →
        </Link>
        <p>
          {R} · {ruleset ? 'Seeded' : 'Not seeded'} · {traitCatalog.length}{' '}
          canonical values · {collectionSets.length} sets
        </p>
      </section>
      <div className="profile-grid">
        <section className="panel">
          <h2>Materialized state</h2>
          <p>{collectors} collectors evaluated</p>
          <p>{traits} active trait discoveries</p>
          <p>
            {completed} historical / {current} current set completions
          </p>
        </section>
        <section className="panel">
          <h2>Replay checkpoint</h2>
          <pre>{JSON.stringify(replay, null, 2)}</pre>
        </section>
      </div>
      <form className="filters">
        <label>
          Collector UUID
          <input name="collector" defaultValue={id.success ? id.data : ''} />
        </label>
        <label>
          Set
          <select name="set" defaultValue={key ?? ''}>
            <option value="">All sets</option>
            {collectionSets.map((s) => (
              <option key={s.key} value={s.key}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <button className="button">Explain</button>
      </form>
      {view?.status === 'pending' && (
        <p>Evaluation pending. Stored evidence below may be stale.</p>
      )}
      {evidence.map((e) => (
        <details className="panel" key={e.setId}>
          <summary>
            {e.setId} · {e.currentlyComplete ? 'COMPLETE' : 'INCOMPLETE'}
          </summary>
          <pre>{JSON.stringify(e, null, 2)}</pre>
        </details>
      ))}
      <h2>Deployment recalculation</h2>
      <p>
        {collectionFailures} failed collection jobs · {achievementFailures}{' '}
        failed collector achievement jobs.
      </p>
      <p>
        Checkpoints track enqueueing, not completed evaluations. Persistent
        failures remain queued; healthy profiles continue. Safe error codes
        identify configuration, timeout, contention or evidence problems.
      </p>
      <pre className="panel">{JSON.stringify(startupReplays, null, 2)}</pre>
      <h2>Pending / failed collector achievements</h2>
      <pre className="panel">{JSON.stringify(achievementJobs, null, 2)}</pre>
      <h2>Recent achievement failures / interruptions</h2>
      <pre className="panel">{JSON.stringify(achievementRuns, null, 2)}</pre>
      <h2>Pending / failed evaluations</h2>
      <pre className="panel">{JSON.stringify(jobs, null, 2)}</pre>
      <h2>Recent runs</h2>
      <pre className="panel">{JSON.stringify(runs, null, 2)}</pre>
      <h2>Correction audit</h2>
      <pre className="panel">{JSON.stringify(audit, null, 2)}</pre>
      <h2>Code-controlled rules</h2>
      {collectionSets.map((s) => (
        <details key={s.key} className="panel">
          <summary>
            {s.name} · {s.mode}
          </summary>
          <p>{s.requirements.map(requirementLabel).join(' AND ')}</p>
        </details>
      ))}
    </>
  );
}
