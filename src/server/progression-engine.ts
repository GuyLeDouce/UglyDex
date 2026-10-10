import 'server-only';
import { db } from './db';
import { Prisma } from '@/generated/prisma/client';
import { hash } from '@/domain/events';
import type { DerivedReadClient } from './derived-verification';
import {
  RULESET,
  xpRules,
  achievements,
  evaluate,
  type Subject,
  type Fact,
} from '@/domain/progression';
const json = (v: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(v));
export async function seedProgression() {
  const configuration = {
    xpRules,
    achievements,
    curves: {
      collector: 50,
      squig: 25,
      formula: 'factor * level * (level - 1)',
    },
    semantics: 1,
  };
  const fingerprint = hash(configuration);
  await db().$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${RULESET},0))`;
      const prior = await tx.progressionRuleset.findUnique({
        where: { id: RULESET },
      });
      if (prior && prior.fingerprint !== fingerprint)
        throw new Error('RULESET_VERSION_BUMP_REQUIRED');
      await tx.progressionRuleset.upsert({
        where: { id: RULESET },
        update: {},
        create: {
          id: RULESET,
          fingerprint,
          configuration: json(configuration),
        },
      });
      for (const [sortOrder, a] of achievements.entries())
        await tx.achievementDefinition.upsert({
          where: { id: `${RULESET}:${a.key}` },
          update: {},
          create: {
            id: `${RULESET}:${a.key}`,
            name: a.name,
            description: a.description,
            rules: json(a),
            ruleset: RULESET,
            subjectType: a.subject,
            category: a.category,
            tier: a.tier,
            hidden: a.hidden,
            title: a.title,
            sortOrder,
          },
        });
    },
    { timeout: 30000 },
  );
}
export async function progressionFacts(
  tx: DerivedReadClient,
  subject: Subject,
  id: string,
) {
  const facts: Fact[] = [];
  // Paginated internal reads; no legacy clients are imported by this module.
  let cursor: string | undefined;
  do {
    const rows = await tx.$queryRaw<
      {
        id: string;
        eventKey: string;
        eventType: string;
        eventAt: Date;
        category: string;
        metadata: Record<string, unknown>;
        sourceType: string;
        sourceSystem: string;
        sourceId: string;
        tokenId: number | null;
      }[]
    >(Prisma.sql`
      SELECT a.id,a."eventKey",a."eventType",a."eventAt",a.category,a.metadata,a."sourceSystem",a."sourceType",a."sourceId",s."tokenId"
      FROM "CollectorActivity" a LEFT JOIN "Squig" s ON s.id=a."squigId"
      WHERE ${subject === 'COLLECTOR' ? Prisma.sql`a."collectorId"=${id}::uuid AND a."attributionStatus" IN ('RESOLVED','DISCORD','WALLET') AND NOT EXISTS(SELECT 1 FROM "ActivityAttributionJob" j WHERE j."walletAddress"=a."walletAddress" AND a."discordId" IS NULL)` : Prisma.sql`a."squigId"=${id}::uuid`}
      AND a."recordStatus"='ACTIVE' AND a.visibility='PUBLIC' AND a."sourceSystem"<>'provenance'
      AND NOT (a."sourceType"='liveImages' AND EXISTS(SELECT 1 FROM "CollectorActivity" sub WHERE sub."sourceType"='submissions' AND (sub.metadata->>'liveImageId'=a."sourceId" OR (sub.metadata->>'imageKey' IS NOT NULL AND sub.metadata->>'imageKey'=a.metadata->>'imageKey'))))
      AND ${cursor ? Prisma.sql`a.id>${cursor}::uuid` : Prisma.sql`TRUE`} ORDER BY a.id LIMIT 500`);
    for (const r of rows)
      facts.push({
        key: r.eventKey,
        activityId: r.id,
        at: r.eventAt.toISOString(),
        type: r.eventType,
        category: r.category,
        metadata: {
          ...r.metadata,
          recordKey: `${r.sourceSystem}:${r.sourceType}:${r.sourceId}`,
        },
        ...(r.tokenId ? { tokenId: r.tokenId } : {}),
      });
    cursor = rows.length === 500 ? rows.at(-1)!.id : undefined;
  } while (cursor);
  // One participation per subject and game, even if two participant slots map to that subject.
  const duelGroups = new Map<string, Fact[]>();
  for (const f of facts.filter((f) => f.type === 'DUEL_COMPLETED')) {
    const k = String(f.metadata.recordKey);
    duelGroups.set(k, [...(duelGroups.get(k) ?? []), f]);
  }
  const deduped = facts.filter((f) => f.type !== 'DUEL_COMPLETED');
  for (const [key, group] of duelGroups) {
    group.sort((a, b) => a.key.localeCompare(b.key));
    const f = group[0];
    deduped.push({
      ...f,
      key: `duel:${key}`,
      metadata: {
        ...f.metadata,
        outcome:
          new Set(group.map((x) => x.metadata.outcome)).size === 1
            ? f.metadata.outcome
            : null,
      },
    });
  }
  let provenance = false;
  if (subject === 'COLLECTOR') {
    const discoveries = await tx.squigDiscovery.findMany({
      where: {
        collectorId: id,
        everOwned: true,
        attributionStatus: 'CONFIRMED',
        squig: { provenance: { dirty: false, complete: true } },
      },
      include: { squig: true },
    });
    const periods = await tx.collectorOwnershipPeriod.findMany({
      where: {
        collectorId: id,
        id: {
          in: discoveries.flatMap((d) =>
            d.firstOwnershipPeriod ? [d.firstOwnershipPeriod] : [],
          ),
        },
      },
      select: { id: true, squigId: true, acquiredAt: true },
    });
    const validPeriods = new Map(periods.map((p) => [p.id, p]));
    for (const d of discoveries) {
      const period = d.firstOwnershipPeriod
        ? validPeriods.get(d.firstOwnershipPeriod)
        : undefined;
      if (
        !period ||
        period.squigId !== d.squigId ||
        period.acquiredAt.getTime() !== d.discoveredAt.getTime()
      )
        continue;
      deduped.push({
        key: `discovery:${d.squigId}`,
        at: d.discoveredAt.toISOString(),
        type: 'DISCOVERY',
        tokenId: d.squig.tokenId,
        category: 'SQUIGS',
        metadata: {
          og: d.squig.og,
          legendary: d.squig.legendary,
          period: d.firstOwnershipPeriod,
        },
      });
    }
  } else {
    const s = await tx.squig.findUniqueOrThrow({
        where: { id },
        include: { provenance: true },
      }),
      p = s.provenance;
    provenance = !!(p?.complete && !p.dirty && p.mintAt && p.mintTransaction);
    if (provenance) {
      deduped.push({
        key: `mint:${p!.mintTransaction}`,
        at: p!.mintAt!.toISOString(),
        type: 'MINT',
        tokenId: s.tokenId,
        category: 'SQUIGS',
        metadata: { og: s.og, legendary: s.legendary },
      });
      const periods = await tx.collectorOwnershipPeriod.findMany({
        where: { squigId: id, lostAt: { not: null } },
        orderBy: { acquiredAt: 'asc' },
      });
      for (const p of periods)
        if (p.lostAt!.getTime() - p.acquiredAt.getTime() >= 7 * 86400000)
          deduped.push({
            key: `hold:${p.id}`,
            at: p.lostAt!.toISOString(),
            type: 'COLLECTOR_HOLD',
            category: 'SQUIGS',
            metadata: { collectorId: p.collectorId },
          });
    }
  }
  const sources = await tx.integrationSource.findMany({
    select: { id: true, state: true },
  });
  return {
    facts: deduped,
    gates: {
      identity: true,
      provenance,
      sources: Object.fromEntries(sources.map((s) => [s.id, s.state])),
    },
  };
}
export async function rebuildSubject(subject: Subject, id: string) {
  const run = await db().syncRun.create({
    data: {
      source: `progression:${RULESET}`,
      counts: {},
      cursorStart: { subject, id },
    },
  });
  try {
    const counts = await db().$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`progression:${subject}:${id}`},0))`;
        await tx.syncRun.updateMany({
          where: {
            source: `progression:${RULESET}`,
            status: 'RUNNING',
            startedAt: { lt: run.startedAt },
            cursorStart: { path: ['id'], equals: id },
          },
          data: {
            status: 'INTERRUPTED',
            finishedAt: new Date(),
            errorCode: 'REPLACED_BY_RESUMED_EVALUATION',
          },
        });
        const job = await tx.progressionJob.findUnique({
          where: {
            subjectType_subjectId: { subjectType: subject, subjectId: id },
          },
        });
        const { facts, gates } = await progressionFacts(tx, subject, id),
          result = evaluate(subject, facts, gates);
        const counts = {
          activities: facts.length,
          created: 0,
          revoked: 0,
          unlocked: 0,
          achievementsRevoked: 0,
        };
        const scope = { ruleset: RULESET, subjectType: subject, subjectId: id };
        const prior = await tx.xpLedgerEntry.findMany({
          where: { ...scope, revokedAt: null },
        });
        const priorIds = new Set(prior.map((g) => g.id));
        const desired = result.grants.map((g) => ({
          ...g,
          id: hash([
            RULESET,
            subject,
            id,
            g.key,
            g.xp,
            g.fact.at,
            g.fact.metadata,
          ]),
        }));
        const ids = new Set(desired.map((g) => g.id));
        for (const old of prior)
          if (!ids.has(old.id)) {
            await tx.xpLedgerEntry.update({
              where: { id: old.id },
              data: { revokedAt: new Date() },
            });
            await tx.progressionAudit.create({
              data: {
                ...scope,
                kind: 'XP_REVOKED',
                reference: old.id,
                before: json(old.evidence),
              },
            });
            counts.revoked++;
          }
        for (const g of desired) {
          if (priorIds.has(g.id)) continue;
          const data = {
            ...scope,
            ruleId: g.rule,
            grantKey: g.key,
            xp: g.xp,
            earnedAt: new Date(g.fact.at),
            sourceActivityId: g.fact.activityId,
            evidence: json({
              key: g.fact.key,
              tokenId: g.fact.tokenId,
              reason: g.rule,
              at: g.fact.at,
            }),
          };
          await tx.xpLedgerEntry.upsert({
            where: { id: g.id },
            create: { id: g.id, ...data },
            update: { revokedAt: null, ...data },
          });
          await tx.progressionAudit.create({
            data: {
              ...scope,
              kind: 'XP_GRANTED',
              reference: g.id,
              after: data.evidence,
            },
          });
          counts.created++;
        }
        for (const a of result.awards) {
          const achievementId = `${RULESET}:${a.definition.key}`;
          const old =
            subject === 'COLLECTOR'
              ? await tx.collectorAchievement.findUnique({
                  where: {
                    collectorId_achievementId: {
                      collectorId: id,
                      achievementId,
                    },
                  },
                })
              : await tx.squigAchievement.findUnique({
                  where: {
                    squigId_achievementId: { squigId: id, achievementId },
                  },
                });
          const active = !!old && !old.revokedAt;
          const evidence = json({
            keys: a.evidence.slice(0, a.definition.threshold),
            count: a.progress,
            threshold: a.definition.threshold,
            gate: a.definition.gate,
            qualifyingAt: a.at,
          });
          if (
            active !== a.unlocked ||
            (old && hash(old.evidence) !== hash(evidence))
          ) {
            await tx.progressionAudit.create({
              data: {
                ...scope,
                kind: a.unlocked
                  ? active
                    ? 'ACHIEVEMENT_CORRECTED'
                    : 'ACHIEVEMENT_UNLOCKED'
                  : active
                    ? 'ACHIEVEMENT_REVOKED'
                    : 'PROGRESS_CORRECTED',
                reference: achievementId,
                ...(old ? { before: json(old.evidence) } : {}),
                after: evidence,
              },
            });
            if (a.unlocked && !active) counts.unlocked++;
            if (active && !a.unlocked) counts.achievementsRevoked++;
          }
          const data = {
            evidence,
            progress: a.progress,
            gateSatisfied: a.gate,
            evaluatedAt: new Date(),
            awardedAt: a.at ? new Date(a.at) : (old?.awardedAt ?? null),
            revokedAt: a.unlocked ? null : (old?.revokedAt ?? new Date()),
          };
          if (subject === 'COLLECTOR')
            await tx.collectorAchievement.upsert({
              where: {
                collectorId_achievementId: { collectorId: id, achievementId },
              },
              create: { collectorId: id, achievementId, ...data },
              update: data,
            });
          else
            await tx.squigAchievement.upsert({
              where: { squigId_achievementId: { squigId: id, achievementId } },
              create: { squigId: id, achievementId, ...data },
              update: data,
            });
        }
        await tx.progressionMilestone.deleteMany({ where: scope });
        if (result.milestones.length)
          await tx.progressionMilestone.createMany({
            data: result.milestones.map((m) => ({
              ...scope,
              level: m.level,
              reachedAt: new Date(m.at),
            })),
          });
        const progress = {
          xp: result.total,
          level: result.level,
          rulesVersion: RULESET,
          calculatedAt: new Date(),
        };
        if (subject === 'COLLECTOR')
          await tx.collectorProgress.upsert({
            where: { collectorId: id },
            create: { collectorId: id, ...progress },
            update: progress,
          });
        else
          await tx.squigProgress.upsert({
            where: { squigId: id },
            create: { squigId: id, ...progress },
            update: progress,
          });
        if (job)
          await tx.progressionJob.deleteMany({
            where: {
              subjectType: subject,
              subjectId: id,
              generation: job.generation,
            },
          });
        await tx.syncRun.update({
          where: { id: run.id },
          data: {
            status: 'COMPLETE',
            counts,
            finishedAt: new Date(),
            cursorEnd: { subject, id },
          },
        });
        return counts;
      },
      { isolationLevel: 'RepeatableRead', timeout: 60000 },
    );
    return counts;
  } catch (cause) {
    await db().syncRun.update({
      where: { id: run.id },
      data: {
        status: 'FAILED',
        errorCode: 'PROGRESSION_EVALUATION_FAILED',
        finishedAt: new Date(),
      },
    });
    await db().progressionJob.upsert({
      where: { subjectType_subjectId: { subjectType: subject, subjectId: id } },
      create: {
        subjectType: subject,
        subjectId: id,
        errorCode: 'EVALUATION_FAILED',
        attempts: 1,
      },
      update: {
        attempts: { increment: 1 },
        errorCode: 'EVALUATION_FAILED',
        queuedAt: new Date(),
      },
    });
    throw new Error('PROGRESSION_EVALUATION_FAILED', { cause });
  }
}
export async function processProgression(limit = 50, shouldStop = () => false) {
  const jobs = await db().progressionJob.findMany({
    orderBy: { queuedAt: 'asc' },
    take: limit,
  });
  let failed = 0,
    processed = 0;
  for (const j of jobs) {
    if (shouldStop()) break;
    try {
      await rebuildSubject(j.subjectType as Subject, j.subjectId);
      processed++;
    } catch {
      failed++;
    }
  }
  return { processed, failed };
}
// Durable enqueue cursor; restart resumes. Evaluation uses the same targeted queue.
export async function queueReplay(restart = false) {
  const id = RULESET;
  await db().$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`replay:${id}`},0))`;
      let replay = await tx.progressionReplay.upsert({
        where: { id },
        create: { id },
        update: restart
          ? { stage: 'COLLECTOR', cursor: null, completedAt: null }
          : {},
      });
      if (replay.completedAt) return;
      const subject = replay.stage as Subject;
      const where = replay.cursor ? { id: { gt: replay.cursor } } : {};
      const rows =
        subject === 'COLLECTOR'
          ? await tx.collector.findMany({
              where,
              select: { id: true },
              orderBy: { id: 'asc' },
              take: 200,
            })
          : await tx.squig.findMany({
              where,
              select: { id: true },
              orderBy: { id: 'asc' },
              take: 200,
            });
      for (const r of rows)
        await tx.$executeRaw`SELECT progression_enqueue(${subject},${r.id}::uuid)`;
      replay = await tx.progressionReplay.update({
        where: { id },
        data:
          rows.length === 200
            ? { cursor: rows.at(-1)!.id }
            : subject === 'COLLECTOR'
              ? { stage: 'SQUIG', cursor: null }
              : { completedAt: new Date() },
      });
    },
    { timeout: 30000 },
  );
  return (await db().progressionReplay.findUniqueOrThrow({ where: { id } }))
    .completedAt;
}
