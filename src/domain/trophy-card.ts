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
// Set Cards represent a qualifying current collection. Historical records remain separate.
export const setFinishes: Record<string, CardRarity> = {
  Easy: 'common',
  Medium: 'rare',
  Hard: 'epic',
  Insane: 'legendary',
};
export type TrophyCardData = {
  key: string;
  kind: 'achievement' | 'set';
  name: string;
  description: string;
  rarity: CardRarity;
  classification: string;
  badgeUrl: string;
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
export function isCurrentSetCard(s: {
  mode: string;
  complete: boolean;
  revealed: boolean;
}) {
  return s.mode === 'CURRENT_HOLDING' && s.complete && s.revealed;
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
  if (!isCurrentSetCard(s)) return null;
  return {
    ...identity,
    key: s.key,
    kind: 'set',
    name: s.name,
    description: s.description,
    rarity: setFinishes[s.difficulty] ?? 'unclassified',
    classification: s.difficulty,
    badgeUrl: setIcons[s.key] ?? '/icons/sets/first-specimen.png',
    status: 'CURRENT HOLDING COMPLETE',
  };
}
