import { notFound } from 'next/navigation';
import { z } from 'zod';
import { adminActor } from '@/server/admin';
import { db } from '@/server/db';
import { RULESET, achievements, xpRules } from '@/domain/progression';
import { Prisma } from '@/generated/prisma/client';
export const dynamic = 'force-dynamic';
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!(await adminActor())) notFound();
  const p = await searchParams,
    v = (key: string) =>
      typeof p[key] === 'string' ? p[key].slice(0, 200) : undefined;
  const collector = z.uuid().safeParse(v('collector')),
    token = z.coerce.number().int().min(1).max(4444).safeParse(v('squig'));
  const squig = token.success
    ? await db().squig.findFirst({ where: { tokenId: token.data } })
    : null;
  const subjectId = collector.success ? collector.data : squig?.id;
  const type = collector.success ? 'COLLECTOR' : 'SQUIG';
  const where: Prisma.XpLedgerEntryWhereInput = {
    ruleset: RULESET,
    ...(subjectId ? { subjectId, subjectType: type } : {}),
    ...(v('rule') ? { ruleId: v('rule') } : {}),
    ...(v('activity') ? { sourceActivityId: v('activity') } : {}),
    ...(z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .safeParse(v('after')).success
      ? { id: { gt: v('after') } }
      : {}),
  };
  const [
    ruleset,
    grants,
    jobs,
    runs,
    sources,
    collectors,
    squigs,
    active,
    revoked,
    awardCount,
    revokedAwards,
    unresolved,
    squigAwards,
    replay,
  ] = await Promise.all([
    db().progressionRuleset.findUnique({ where: { id: RULESET } }),
    db().xpLedgerEntry.findMany({ where, orderBy: { id: 'asc' }, take: 51 }),
    db().progressionJob.findMany({ orderBy: { queuedAt: 'asc' }, take: 20 }),
    db().syncRun.findMany({
      where: { source: `progression:${RULESET}` },
      orderBy: { startedAt: 'desc' },
      take: 10,
    }),
    db().integrationSource.findMany(),
    db().collectorProgress.count({ where: { rulesVersion: RULESET } }),
    db().squigProgress.count({ where: { rulesVersion: RULESET } }),
    db().xpLedgerEntry.count({ where: { ruleset: RULESET, revokedAt: null } }),
    db().xpLedgerEntry.count({
      where: { ruleset: RULESET, revokedAt: { not: null } },
    }),
    db().collectorAchievement.count({
      where: { achievement: { ruleset: RULESET }, revokedAt: null },
    }),
    db().progressionAudit.count({
      where: { ruleset: RULESET, kind: 'ACHIEVEMENT_REVOKED' },
    }),
    db().collectorActivity.count({
      where: { collectorId: null, recordStatus: 'ACTIVE' },
    }),
    db().squigAchievement.count({
      where: { achievement: { ruleset: RULESET }, revokedAt: null },
    }),
    db().progressionReplay.findUnique({ where: { id: RULESET } }),
  ]);
  const awards = subjectId
    ? type === 'COLLECTOR'
      ? await db().collectorAchievement.findMany({
          where: { collectorId: subjectId, achievement: { ruleset: RULESET } },
        })
      : await db().squigAchievement.findMany({
          where: { squigId: subjectId, achievement: { ruleset: RULESET } },
        })
    : [];
  const query = new URLSearchParams();
  for (const [k, value] of Object.entries(p))
    if (typeof value === 'string') query.set(k, value);
  query.set('after', grants[49]?.id ?? '');
  return (
    <>
      <section className="page-heading">
        <p className="eyebrow">INTERNAL / EXPLAINABLE PROGRESSION</p>
        <h1>Progression laboratory.</h1>
        <p>
          {RULESET} · {ruleset?.status ?? 'Not seeded'}
        </p>
      </section>
      <section className="panel">
        <p>
          {collectors} collectors · {squigs} Squigs evaluated
        </p>
        <p>
          {active} active grants · {revoked} revoked grants · {awardCount}{' '}
          Collector achievements · {squigAwards} Squig achievements ·{' '}
          {revokedAwards} revocation decisions
        </p>
        <p>
          {unresolved} unresolved source activities (Collector XP ineligible)
        </p>
      </section>
      <form method="get" className="panel">
        {['collector', 'squig', 'achievement', 'rule', 'activity'].map((k) => (
          <label key={k}>
            {k}
            <input name={k} defaultValue={v(k)} />
          </label>
        ))}
        <button className="button">Explain</button>
      </form>
      {subjectId && (
        <section className="panel">
          <h2>Achievement evaluation</h2>
          {achievements
            .filter(
              (a) =>
                a.subject === type &&
                (!v('achievement') || a.key === v('achievement')),
            )
            .map((a) => {
              const row = awards.find(
                (r) => r.achievementId === `${RULESET}:${a.key}`,
              );
              return (
                <details key={a.key}>
                  <summary>
                    {a.name} · {row && !row.revokedAt ? 'UNLOCKED' : 'LOCKED'} ·{' '}
                    {row?.progress ?? 0}/{a.threshold}
                  </summary>
                  <p>
                    Gate: {a.gate} ·{' '}
                    {row?.gateSatisfied
                      ? 'satisfied'
                      : 'blocked or unevaluated'}
                  </p>
                  <pre>{JSON.stringify(row?.evidence ?? {}, null, 2)}</pre>
                </details>
              );
            })}
        </section>
      )}
      <section className="panel">
        <h2>XP evidence</h2>
        {grants.slice(0, 50).map((g) => (
          <details key={g.id}>
            <summary>
              {g.ruleId} · {g.xp} XP · {g.revokedAt ? 'REVOKED' : 'ACTIVE'} ·{' '}
              {g.earnedAt.toISOString()}
            </summary>
            <pre>
              {JSON.stringify(
                {
                  subject: g.subjectId,
                  activity: g.sourceActivityId,
                  evidence: g.evidence,
                },
                null,
                2,
              )}
            </pre>
          </details>
        ))}
        {grants.length > 50 && <a href={`?${query}`}>Next grants →</a>}
      </section>
      <section className="panel">
        <h2>Rules (code controlled)</h2>
        {xpRules.map((r) => (
          <p key={r.key}>
            {r.key} · {r.xp} XP ·{' '}
            {r.cap ? `first ${r.cap}` : 'each qualifying fact'} · {r.gate}
          </p>
        ))}
      </section>
      <section className="panel">
        <h2>Completeness and pending work</h2>
        {sources.map((s) => (
          <p key={s.id}>
            {s.id}: {s.state}
          </p>
        ))}
        {jobs.map((j) => (
          <p key={`${j.subjectType}:${j.subjectId}`}>
            {j.subjectType} {j.subjectId} · {j.errorCode ?? 'QUEUED'} ·{' '}
            {j.attempts} failed attempts
          </p>
        ))}
      </section>
      <section className="panel">
        <h2>Recent evaluations</h2>
        <p>
          Global enqueue:{' '}
          {replay?.completedAt ? 'complete' : (replay?.stage ?? 'not started')}{' '}
          · {replay?.cursor ?? 'no cursor'}
        </p>
        {runs.map((r) => (
          <p key={r.id}>
            {r.status} · {r.startedAt.toISOString()} ·{' '}
            {JSON.stringify(r.counts)}
          </p>
        ))}
      </section>
    </>
  );
}
