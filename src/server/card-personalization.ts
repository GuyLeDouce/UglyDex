import 'server-only';
import { collectionSets } from '@/domain/dex-catalog';
import { setIcons } from '@/domain/set-icons';
import type { Candidates } from './dex-engine';

export type FieldGuideFilter = '' | 'advances' | 'traits' | 'undiscovered';

export function matchesFieldGuide(
  candidate: Candidates[string] | undefined,
  filter: FieldGuideFilter,
  set = '',
) {
  if (!filter && !set) return true;
  if (!candidate) return false;
  return (
    (!set || candidate.sets.includes(set)) &&
    (!filter ||
      (filter === 'undiscovered'
        ? !candidate.discovered
        : filter === 'traits'
          ? candidate.missingTraits > 0
          : candidate.sets.length > 0))
  );
}

export function cardPersonalization(candidate: Candidates[string] | undefined) {
  return candidate
    ? {
        personalization: {
          discovered: candidate.discovered,
          owned: candidate.owned,
          missingTraits: candidate.missingTraits,
          advances: candidate.sets.length,
          sets: collectionSets
            .filter((set) => !set.hidden && candidate.sets.includes(set.key))
            .map((set) => ({
              key: set.key,
              name: set.name,
              icon: setIcons[set.key] ?? '/icons/sets/first-specimen.png',
              description: set.description,
            })),
        },
      }
    : {};
}
