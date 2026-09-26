import type { Prisma } from '@/generated/prisma/client';
import 'server-only';
import { db } from './db';
import {
  RULESET,
  achievements,
  levelInfo,
  xpRules,
  metricLabel,
  type Subject,
} from '@/domain/progression';
async function readProjection(
  tx: Prisma.TransactionClient,
  subject: Subject,
  id: string,
  isPublic = false,
) {
  const collector =
    subject === 'COLLECTOR'
      ? await tx.collector.findUnique({
          where: { id },
          select: {
            isPublic: true,
            selectedTitleId: true,
            featuredAchievementIds: true,
          },
        })
      : null;
  if (
    subject === 'COLLECTOR' &&
    (!collector || (isPublic && !collector.isPublic))
  )
    return null;
  const pending = await tx.progressionJob.findUnique({
    where: { subjectType_subjectId: { subjectType: subject, subjectId: id } },
  });
  const progress =
    subject === 'COLLECTOR'
      ? await tx.collectorProgress.findUnique({ where: { collectorId: id } })
      : await tx.squigProgress.findUnique({ where: { squigId: id } });
  // Read this materialized snapshot on one connection; never mix two evaluations.
  if (pending || !progress || progress.rulesVersion !== RULESET)
    return { status: 'pending' as const };
  const awards =
    subject === 'COLLECTOR'
      ? await tx.collectorAchievement.findMany({
          where: { collectorId: id, achievement: { ruleset: RULESET } },
        })
      : await tx.squigAchievement.findMany({
          where: { squigId: id, achievement: { ruleset: RULESET } },
        });
  const milestones = await tx.progressionMilestone.findMany({
    where: { ruleset: RULESET, subjectType: subject, subjectId: id },
    orderBy: { level: 'desc' },
    take: 5,
  });
  const breakdown = await tx.xpLedgerEntry.groupBy({
    by: ['ruleId'],
    where: {
      ruleset: RULESET,
      subjectType: subject,
      subjectId: id,
      revokedAt: null,
    },
    _count: { _all: true },
    _sum: { xp: true },
  });
  const cards = achievements
    .filter((a) => a.subject === subject && a.enabled)
    .map((a) => {
      const award = awards.find(
          (r) => r.achievementId === `${RULESET}:${a.key}`,
        ),
        unlocked = !!award && !award.revokedAt;
      if (a.hidden && !unlocked)
        return {
          key: a.key,
          name: '???',
          description: 'A little mystery remains.',
          category: a.category,
          tier: 'Secret',
          unlocked: false,
          progress: 0,
          threshold: 0,
          at: null,
          title: null,
          blocked: false,
        };
      return {
        key: a.key,
        name: a.name,
        description: a.description,
        category: a.category,
        tier: a.tier,
        unlocked,
        progress: award?.progress ?? 0,
        threshold: a.threshold,
        at: unlocked ? award!.awardedAt!.toISOString() : null,
        title: unlocked ? (a.title ?? null) : null,
        blocked: !award?.gateSatisfied,
      };
    });
  const unlocked = cards.filter((c) => c.unlocked);
  return {
    status: 'ready' as const,
    breakdown: breakdown.flatMap((b) => {
      const rule = xpRules.find((r) => r.key === b.ruleId);
      return rule
        ? [
            {
              label: metricLabel[rule.metric],
              count: b._count._all,
              xp: String(b._sum.xp ?? 0),
            },
          ]
        : [];
    }),
    ...levelInfo(subject, progress.xp),
    cards,
    count: unlocked.length,
    title:
      unlocked.find((a) => `${RULESET}:${a.key}` === collector?.selectedTitleId)
        ?.title ?? null,
    featured: unlocked
      .filter((a) =>
        collector?.featuredAchievementIds.includes(`${RULESET}:${a.key}`),
      )
      .slice(0, 4)
      .map((a) => a.name),
    recent: [...unlocked]
      .sort((a, b) => b.at!.localeCompare(a.at!))
      .slice(0, 3)
      .map((a) => ({ name: a.name, at: a.at })),
    milestones: milestones.map((m) => ({
      level: m.level,
      at: m.reachedAt.toISOString(),
    })),
  };
}

export async function progressionView(
  subject: Subject,
  id: string,
  isPublic = false,
) {
  return db().$transaction((tx) => readProjection(tx, subject, id, isPublic), {
    isolationLevel: 'RepeatableRead',
    timeout: 15000,
  });
}
