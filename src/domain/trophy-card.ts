import { setIcons } from './set-icons';
import type { CardRarity } from './trading-card';
import type { AchievementBadgePresentation } from './achievement-badges';
export const achievementTiers = [
  'Common',
  'Uncommon',
  'Rare',
  'Epic',
  'Legendary',
] as const;
export type TrophyCardData = {
  key: string;
  kind: 'achievement' | 'set';
  name: string;
  description: string;
  rarity: CardRarity;
  classification: string;
  badgeUrl: string;
  setIcon?: string;
  collector: string;
  avatarTokenId: number | null;
  status: string;
};
export type TrophyIdentity = Pick<
  TrophyCardData,
  'collector' | 'avatarTokenId'
>;
export function achievementTrophy(
  a: {
    key: string;
    name: string;
    description: string;
    tier: string;
    unlocked: boolean;
    badge: AchievementBadgePresentation;
  },
  identity: TrophyIdentity,
): TrophyCardData | null {
  if (
    !a.unlocked ||
    a.badge.status !== 'earned' ||
    a.badge.subject !== 'COLLECTOR'
  )
    return null;
  return {
    ...identity,
    key: a.key,
    kind: 'achievement',
    name: a.name,
    description: a.description,
    rarity: achievementTiers.includes(
      a.tier as (typeof achievementTiers)[number],
    )
      ? (a.tier.toLowerCase() as CardRarity)
      : 'unclassified',
    classification: a.tier,
    badgeUrl: a.badge.url,
    status: 'ACHIEVEMENT UNLOCKED',
  };
}
export function setTrophy(
  s: {
    key: string;
    name: string;
    description: string;
    difficulty: string;
    complete: boolean;
    revealed: boolean;
    mode: string;
  },
  identity: TrophyIdentity,
): TrophyCardData | null {
  if (!s.complete || !s.revealed) return null;
  return {
    ...identity,
    key: s.key,
    kind: 'set',
    name: s.name,
    description: s.description,
    rarity: 'unclassified',
    classification: s.difficulty,
    badgeUrl: '/achievements/collector/deep-in-the-dex.png',
    setIcon: setIcons[s.key],
    status:
      s.mode === 'CURRENT_HOLDING'
        ? 'CURRENT HOLDING COMPLETE'
        : 'HISTORICAL SET COMPLETE',
  };
}
