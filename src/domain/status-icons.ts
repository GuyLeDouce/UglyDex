import { collectionSets } from './dex-catalog';
import { evaluateSet, type DexToken } from './dex';
export type StatusIconData = {
  key: string;
  name: string;
  description: string;
  href?: string;
};
export function personalStatusIcons(
  token: DexToken,
  candidate: {
    owned: boolean;
    discovered: boolean;
    missingTraits: number;
    sets: string[];
  },
  historical: DexToken[],
  current: DexToken[],
  featuredKeys: string[],
): StatusIconData[] {
  const result: StatusIconData[] = [];
  const add = (key: string, name: string, description: string) =>
    result.push({ key, name, description });
  if (candidate.owned)
    add('currently-owned', 'Currently owned', 'You currently hold this Squig.');
  else if (candidate.discovered)
    add(
      'previously-owned',
      'Previously owned',
      'You previously collected this Squig.',
    );
  else
    add(
      'new-discovery',
      'New discovery',
      'You have not discovered this Squig in your indexed collection history.',
    );
  if (candidate.missingTraits > 0)
    add(
      'missing-trait',
      'Missing trait',
      `Adds ${candidate.missingTraits} traits you have not discovered.`,
    );
  const advancing = collectionSets.filter(
    (s) => !s.hidden && candidate.sets.includes(s.key),
  );
  if (advancing.length)
    add(
      'advances-set',
      'Advances a set',
      advancing.map((s) => s.name).join(', '),
    );
  const completes = advancing.filter((s) => {
    const held = s.mode === 'CURRENT_HOLDING' ? current : historical;
    return (
      !evaluateSet(s, held).complete &&
      evaluateSet(s, [...held, token]).complete
    );
  });
  if (completes.length)
    add(
      'completes-set',
      'Completes a set',
      `Adding this Squig would complete: ${completes.map((s) => s.name).join(', ')}.`,
    );
  const featured = collectionSets.filter(
    (s) =>
      !s.hidden &&
      featuredKeys.includes(s.key) &&
      s.requirements.some(
        (r) => evaluateSet({ ...s, requirements: [r] }, [token]).progress > 0,
      ),
  );
  if (featured.length)
    add(
      'featured-set',
      'Featured set match',
      `Contributes to your featured sets: ${featured.map((s) => s.name).join(', ')}.`,
    );
  return result;
}
