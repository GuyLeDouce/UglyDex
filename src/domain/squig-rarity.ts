const supportedRarities = new Set([
  'common',
  'uncommon',
  'rare',
  'epic',
  'legendary',
]);

export function squigRarityClass(rarity: string | null | undefined) {
  const normalized = rarity?.trim().toLowerCase();
  return normalized && supportedRarities.has(normalized)
    ? `rarity-${normalized}`
    : 'rarity-unclassified';
}
