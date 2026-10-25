import 'server-only';
import { achievements } from '@/domain/progression';
import { collectionSets } from '@/domain/dex-catalog';
import { highestFamilyBadges } from './achievement-badges';

const tiers = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'];
export function rankedShareAchievements<T extends { key: string }>(
  rows: T[],
  limit: number,
) {
  const tier = (key: string) =>
    tiers.indexOf(achievements.find((a) => a.key === key)?.tier ?? '');
  return highestFamilyBadges(rows, Infinity)
    .sort((a, b) => tier(b.key) - tier(a.key) || a.key.localeCompare(b.key))
    .slice(0, limit);
}

// Sets with the same evidence requirements but different thresholds are one family.
// Keep historical and current-holding families separate.
export function rankedShareSets<
  T extends { key: string; difficulty: string; required: number },
>(rows: T[], limit: number) {
  const difficulty = ['Easy', 'Medium', 'Hard', 'Insane'];
  const sorted = [...rows].sort(
    (a, b) =>
      difficulty.indexOf(b.difficulty) - difficulty.indexOf(a.difficulty) ||
      b.required - a.required ||
      a.key.localeCompare(b.key),
  );
  const seen = new Set<string>();
  return sorted
    .filter((row) => {
      const definition = collectionSets.find((s) => s.key === row.key);
      const family = definition
        ? JSON.stringify([
            definition.mode,
            definition.requirements.map((requirement) => ({
              kind: requirement.kind,
              filter: requirement.filter,
              traitType: requirement.traitType,
              tokenIds: requirement.tokenIds,
            })),
          ])
        : row.key;
      if (seen.has(family)) return false;
      seen.add(family);
      return true;
    })
    .slice(0, limit);
}
export function favoriteFirst(
  favorites: number[],
  ranked: number[],
  limit: number,
) {
  return [...new Set([...favorites.slice(0, 6), ...ranked])].slice(0, limit);
}
