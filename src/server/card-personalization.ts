import 'server-only';
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
        },
      }
    : {};
}
