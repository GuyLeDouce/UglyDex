import 'server-only';
import { achievements, RULESET, type Subject } from '@/domain/progression';
import type {
  AchievementBadgePresentation,
  AchievementBadgeSummary,
  VisibleAchievementBadge,
} from '@/domain/achievement-badges';
import {
  achievementBadgeAssets,
  type AchievementBadgeId,
} from './achievement-badge-assets';
import { db } from './db';

export function getAchievementBadgeUrl(
  key: string,
  earned = false,
  collectorId?: string,
) {
  if (!Object.hasOwn(achievementBadgeAssets, key)) return null;
  const definition = achievements.find((a) => a.key === key);
  if (!definition) return null;
  const url = achievementBadgeAssets[key as AchievementBadgeId];
  if (!definition.hidden) return url;
  return earned && collectorId
    ? `${url}?collector=${encodeURIComponent(collectorId)}`
    : null;
}

export function achievementBadgePresentation(
  key: string,
  unlocked: boolean,
  blocked = false,
  collectorId?: string,
): AchievementBadgePresentation {
  const a = achievements.find((a) => a.key === key);
  const url = getAchievementBadgeUrl(key, unlocked, collectorId);
  if (!a || !url) return { status: 'hidden' };
  return {
    key,
    name: a.name,
    subject: a.subject,
    url,
    status: unlocked ? 'earned' : blocked ? 'pending' : 'locked',
  };
}

// Existing catalog display tiers only. This is presentation order, never NFT rarity.
const prestige = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'];
export function earnedBadgeSummary(
  subject: Subject,
  cards: { badge: AchievementBadgePresentation }[],
): AchievementBadgeSummary {
  const byKey = new Map(
    cards.flatMap(({ badge }) =>
      badge.status === 'earned' && badge.subject === subject
        ? [[badge.key, badge] as const]
        : [],
    ),
  );
  const badges = achievements
    .filter((a) => a.subject === subject && byKey.has(a.key))
    .map((a, order) => ({
      badge: byKey.get(a.key)!,
      tier: prestige.indexOf(a.tier),
      order,
    }))
    .sort((a, b) => b.tier - a.tier || a.order - b.order)
    .map(({ badge }) => badge);
  return { status: 'ready', badges };
}

// One snapshot and three batched queries per collection, never one request per card.
export async function squigBadgeSummaries(ids: string[]) {
  if (!ids.length) return new Map<string, AchievementBadgeSummary>();
  return db().$transaction(
    async (tx) => {
      const [pending, progress, awards] = await Promise.all([
        tx.progressionJob.findMany({
          where: { subjectType: 'SQUIG', subjectId: { in: ids } },
          select: { subjectId: true },
        }),
        tx.squigProgress.findMany({
          where: { squigId: { in: ids }, rulesVersion: RULESET },
          select: { squigId: true },
        }),
        tx.squigAchievement.findMany({
          where: {
            squigId: { in: ids },
            revokedAt: null,
            achievement: { ruleset: RULESET, subjectType: 'SQUIG' },
          },
          select: { squigId: true, achievementId: true },
        }),
      ]);
      const queued = new Set(pending.map((p) => p.subjectId));
      const ready = new Set(progress.map((p) => p.squigId));
      const grouped = new Map<string, VisibleAchievementBadge[]>();
      for (const award of awards) {
        const badge = achievementBadgePresentation(
          award.achievementId.slice(RULESET.length + 1),
          true,
        );
        if (badge.status !== 'earned' || badge.subject !== 'SQUIG') continue;
        const list = grouped.get(award.squigId) ?? [];
        list.push(badge);
        grouped.set(award.squigId, list);
      }
      return new Map(
        ids.map((id) => [
          id,
          queued.has(id) || !ready.has(id)
            ? ({ status: 'pending', badges: [] } as AchievementBadgeSummary)
            : earnedBadgeSummary(
                'SQUIG',
                (grouped.get(id) ?? []).map((badge) => ({ badge })),
              ),
        ]),
      );
    },
    { isolationLevel: 'RepeatableRead', timeout: 15000 },
  );
}

// One highest earned threshold per art family, in stable catalog family order.
// Callers supply only viewer-visible earned achievements.
export function highestFamilyBadges<T extends { key: string }>(
  earned: T[],
  limit = 6,
): T[] {
  const byKey = new Map(earned.map((a) => [a.key, a]));
  const families = new Map<string, { value: T; threshold: number }>();
  for (const definition of achievements) {
    const value = byKey.get(definition.key);
    if (!value) continue;
    const family = `${definition.subject}:${definition.metric}`;
    const previous = families.get(family);
    if (!previous || definition.threshold > previous.threshold)
      families.set(family, { value, threshold: definition.threshold });
  }
  return [...families.values()].slice(0, limit).map((a) => a.value);
}
