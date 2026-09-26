import 'server-only';
import { z } from 'zod';
import { db } from './db';
import { RULESET, achievements } from '@/domain/progression';
export const presentationSchema = z.object({
  title: z.string().max(100),
  badges: z.array(z.string().max(100)).max(4),
});
// collectorId must come from an authenticated server session, never a form field.
export async function updateProgressionPresentation(
  collectorId: string,
  raw: unknown,
) {
  const input = presentationSchema.parse(raw);
  await db().$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`progression:COLLECTOR:${collectorId}`},0))`;
    if (
      await tx.progressionJob.findUnique({
        where: {
          subjectType_subjectId: {
            subjectType: 'COLLECTOR',
            subjectId: collectorId,
          },
        },
      })
    )
      throw new Error('PROGRESSION_PENDING');
    const rows = await tx.collectorAchievement.findMany({
        where: {
          collectorId,
          revokedAt: null,
          achievement: { ruleset: RULESET },
        },
      }),
      allowed = new Set(rows.map((r) => r.achievementId));
    const badges = [...new Set(input.badges)].map((k) => `${RULESET}:${k}`),
      title = input.title ? `${RULESET}:${input.title}` : null;
    if (
      badges.some((k) => !allowed.has(k)) ||
      (title &&
        (!allowed.has(title) ||
          !achievements.find((a) => a.key === input.title)?.title))
    )
      throw new Error('ACHIEVEMENT_NOT_UNLOCKED');
    await tx.collector.update({
      where: { id: collectorId },
      data: { featuredAchievementIds: badges, selectedTitleId: title },
    });
  });
}
