import type { CardRarity } from './trading-card';

const supportedRarities = new Set([
  'common',
  'uncommon',
  'rare',
  'epic',
  'legendary',
]);

export function squigRarity(rarity: string | null | undefined): CardRarity {
  const normalized = rarity?.trim().toLowerCase();
  return normalized && supportedRarities.has(normalized)
    ? (normalized as CardRarity)
    : 'unclassified';
}

export function squigRarityClass(rarity: string | null | undefined) {
  return `rarity-${squigRarity(rarity)}`;
}
