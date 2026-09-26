// Collection semantics are independent of XP. Changes require a ruleset version.
export const COLLECTION_RULESET = 'uglydex-collection-v1';
export const TRAIT_TYPES = [
  'Background',
  'Skin',
  'Type',
  'Body',
  'Mouth',
  'Eyes',
  'Head',
  'Special',
] as const;
export const normalizeTrait = (value: string) =>
  value.normalize('NFC').trim().replace(/\s+/g, ' ');
export const traitKey = (type: string, value: string) =>
  `${normalizeTrait(type)}:${normalizeTrait(value)}`;
export const traitSlug = (value: string) =>
  encodeURIComponent(normalizeTrait(value));
export function decodeTraitSlug(value: string) {
  try {
    return normalizeTrait(decodeURIComponent(value));
  } catch {
    return '';
  }
}
export const traitPath = (type: string, value: string) =>
  `/traits/${traitSlug(type)}/${traitSlug(value)}`;
export type DexToken = {
  tokenId: number;
  traits: Record<string, string>;
  og: boolean;
  legendary: boolean;
  rarityTier: string;
  at?: string;
  evidence?: string;
};
export type TraitEntry = {
  key: string;
  type: string;
  value: string;
  count: number;
  percentage: number;
  firstToken: number;
  legendaryOnly: boolean;
  ogCount: number;
};
export function tokenTraits(token: DexToken) {
  const entries = Object.entries(token.traits).flatMap(([type, value]) => {
    const t = normalizeTrait(type),
      v = normalizeTrait(value);
    return (TRAIT_TYPES as readonly string[]).includes(t) && v
      ? [{ key: traitKey(t, v), type: t, value: v }]
      : [];
  });
  return [...new Map(entries.map((t) => [t.key, t])).values()];
}
export function buildTraitCatalog(tokens: DexToken[]): TraitEntry[] {
  const map = new Map<string, TraitEntry>();
  for (const token of [
    ...new Map(tokens.map((t) => [t.tokenId, t])).values(),
  ].sort((a, b) => a.tokenId - b.tokenId)) {
    for (const t of tokenTraits(token)) {
      const entry = map.get(t.key) ?? {
        ...t,
        count: 0,
        percentage: 0,
        firstToken: token.tokenId,
        legendaryOnly: true,
        ogCount: 0,
      };
      entry.count++;
      entry.ogCount += Number(token.og);
      entry.legendaryOnly &&= token.legendary;
      entry.percentage = (entry.count / 4444) * 100;
      map.set(t.key, entry);
    }
  }
  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
}
export type TokenFilter = {
  traits?: { type: string; values: string[] }[];
  og?: boolean;
  legendary?: boolean;
  rarity?: string;
  tokenIds?: number[];
};
export type Requirement = {
  kind: 'COUNT' | 'UNIQUE_TRAIT_VALUES' | 'TOKEN_IDS';
  count: number;
  filter?: TokenFilter;
  traitType?: string;
  tokenIds?: number[];
};
export type SetDefinition = {
  key: string;
  name: string;
  description: string;
  category: string;
  mode: 'HISTORICAL_DISCOVERY' | 'CURRENT_HOLDING';
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'Insane';
  hidden?: boolean;
  requirements: Requirement[];
};
export function matches(token: DexToken, filter: TokenFilter = {}) {
  return (
    (filter.og === undefined || token.og === filter.og) &&
    (filter.legendary === undefined || token.legendary === filter.legendary) &&
    (!filter.rarity || token.rarityTier === filter.rarity) &&
    (!filter.tokenIds || filter.tokenIds.includes(token.tokenId)) &&
    (filter.traits ?? []).every((t) =>
      t.values.includes(normalizeTrait(token.traits[t.type] ?? '')),
    )
  );
}
export function evaluateRequirement(r: Requirement, tokens: DexToken[]) {
  const sorted = [...new Map(tokens.map((t) => [t.tokenId, t])).values()]
    .filter((t) => matches(t, r.filter))
    .sort(
      (a, b) => (a.at ?? '').localeCompare(b.at ?? '') || a.tokenId - b.tokenId,
    );
  const seen = new Set<string>();
  const qualifying = sorted.filter((t) => {
    if (r.kind === 'TOKEN_IDS') return r.tokenIds?.includes(t.tokenId);
    if (r.kind !== 'UNIQUE_TRAIT_VALUES') return true;
    const value = normalizeTrait(t.traits[r.traitType!] ?? '');
    if (!value || seen.has(value)) return false;
    seen.add(value);
    return true;
  });
  const evidence = qualifying.slice(0, r.count);
  return {
    count: qualifying.length,
    required: r.count,
    complete: qualifying.length >= r.count,
    tokens: evidence.map((t) => t.tokenId),
    at: evidence.length >= r.count ? (evidence.at(-1)?.at ?? null) : null,
  };
}
export function evaluateSet(set: SetDefinition, tokens: DexToken[]) {
  const requirements = set.requirements.map((r) =>
    evaluateRequirement(r, tokens),
  );
  const complete = requirements.every((r) => r.complete);
  return {
    complete,
    progress: requirements.reduce(
      (s, r) => s + Math.min(r.count, r.required),
      0,
    ),
    required: requirements.reduce((s, r) => s + r.required, 0),
    requirements,
    at:
      complete && requirements.every((r) => r.at)
        ? requirements
            .map((r) => r.at!)
            .sort()
            .at(-1)!
        : null,
  };
}
export function completion(
  discovered: number,
  traits: number,
  traitTotal: number,
  historical: number,
  historicalTotal: number,
) {
  const ratio = (n: number, d: number) =>
    d ? Math.min(1, Math.max(0, n / d)) : 0;
  const squig = ratio(discovered, 4444),
    trait = ratio(traits, traitTotal),
    sets = ratio(historical, historicalTotal);
  return {
    squig: squig * 100,
    trait: trait * 100,
    sets: sets * 100,
    overall: Math.round((40 * squig + 35 * trait + 25 * sets) * 10000) / 10000,
  };
}
export function discoverTraits(tokens: DexToken[]) {
  const result = new Map<
    string,
    { tokenId: number; at: string; evidence: string }
  >();
  for (const t of [...tokens].sort(
    (a, b) => (a.at ?? '').localeCompare(b.at ?? '') || a.tokenId - b.tokenId,
  ))
    if (t.at && t.evidence)
      for (const trait of tokenTraits(t))
        if (!result.has(trait.key))
          result.set(trait.key, {
            tokenId: t.tokenId,
            at: t.at,
            evidence: t.evidence,
          });
  return result;
}
export function advances(
  set: SetDefinition,
  tokens: DexToken[],
  candidate: DexToken,
) {
  if (tokens.some((t) => t.tokenId === candidate.tokenId)) return false;
  return set.requirements.some((r) => {
    const before = evaluateRequirement(r, tokens);
    return (
      !before.complete &&
      evaluateRequirement(r, [...tokens, candidate]).count > before.count
    );
  });
}
