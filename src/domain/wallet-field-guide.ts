import { completion, evaluateSet, tokenTraits } from './dex';
import { canonicalTokens, collectionSets, traitCatalog } from './dex-catalog';

const byId = new Map(canonicalTokens.map((token) => [token.tokenId, token]));
/** Observation-only projection. Never creates personal discoveries or awards. */
export function walletFieldGuide(currentIds: number[], historyIds: number[]) {
  const current = [...new Set(currentIds)].flatMap((id) => byId.get(id) ?? []);
  const historical = [...new Set([...currentIds, ...historyIds])].flatMap(
    (id) => byId.get(id) ?? [],
  );
  const traits = new Set(
    historical.flatMap((token) => tokenTraits(token).map((t) => t.key)),
  ).size;
  const sets = collectionSets.map((set) => ({
    definition: set,
    result: evaluateSet(
      set,
      set.mode === 'CURRENT_HOLDING' ? current : historical,
    ),
  }));
  const historicalTotal = collectionSets.filter(
    (s) => s.mode === 'HISTORICAL_DISCOVERY' && !s.hidden,
  ).length;
  const historicalSets = sets.filter(
    (s) =>
      s.definition.mode === 'HISTORICAL_DISCOVERY' &&
      !s.definition.hidden &&
      s.result.complete,
  ).length;
  return {
    owned: current.length,
    discovered: historical.length,
    traits,
    traitTotal: traitCatalog.length,
    historicalSets,
    historicalTotal,
    currentSets: sets.filter(
      (s) => s.definition.mode === 'CURRENT_HOLDING' && s.result.complete,
    ).length,
    score: completion(
      historical.length,
      traits,
      traitCatalog.length,
      historicalSets,
      historicalTotal,
    ),
    sets,
  };
}

export function rankCollectorRows<
  T extends { slug: string; overall: number | null },
>(rows: T[]) {
  const sorted = [...rows].sort(
    (a, b) =>
      (b.overall ?? -1) - (a.overall ?? -1) || a.slug.localeCompare(b.slug),
  );
  let rank = 0;
  let previous: number | null = null;
  return sorted.map((row) => {
    if (row.overall !== null && row.overall !== previous) rank++;
    previous = row.overall;
    return { ...row, rank: row.overall === null ? null : rank };
  });
}
