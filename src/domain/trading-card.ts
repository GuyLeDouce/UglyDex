export const TRADING_CARD_VERSION = 3;
export const TRADING_CARD_WIDTH = 1500;
export const TRADING_CARD_HEIGHT = 2100;
const rarityNames = [
  'common',
  'uncommon',
  'rare',
  'epic',
  'legendary',
] as const;
export type CardRarity = (typeof rarityNames)[number] | 'unclassified';
export type TradingCardData = {
  tokenId: number;
  rarity: CardRarity;
  og: boolean;
  legendary: boolean;
  uglyPoints: string | null;
  mawRank: number | null;
  type: string;
  legend: string | null;
  traits: { traitType: string; value: string }[];
  sourceRevision: string | null;
  metadataUpdatedAt: string | null;
};
const present = (value: string) =>
  !!value.trim() && value.trim().toLowerCase() !== 'none';
const order = [
  'Head',
  'Body',
  'Skin',
  'Eyes',
  'Mouth',
  'Special',
  'Background',
];
// Public token metadata only. Never derive power/status from ownership or artwork.
export function tradingCardData(row: {
  tokenId: number;
  rarityTier: string | null;
  legendary: boolean | null;
  og: boolean | null;
  uglyPoints: { toString(): string } | null;
  mawRank: number | null;
  traits: { traitType: string; value: string }[];
  metadataSourceHash: string | null;
  metadataUpdatedAt: Date | null;
}): TradingCardData {
  const rarity = row.rarityTier?.trim().toLowerCase();
  const value = (key: string) =>
    row.traits.find((t) => t.traitType === key)?.value.trim() ?? '';
  return {
    tokenId: row.tokenId,
    rarity: rarityNames.includes(rarity as (typeof rarityNames)[number])
      ? (rarity as CardRarity)
      : 'unclassified',
    og: row.og === true,
    legendary: row.legendary === true,
    uglyPoints: row.uglyPoints?.toString() ?? null,
    mawRank: row.mawRank,
    type: present(value('Type')) ? value('Type') : 'Squig',
    legend: present(value('Legend')) ? value('Legend') : null,
    traits: order.flatMap((traitType) => {
      const v = value(traitType);
      return present(v) ? [{ traitType, value: v }] : [];
    }),
    sourceRevision: row.metadataSourceHash,
    metadataUpdatedAt: row.metadataUpdatedAt?.toISOString() ?? null,
  };
}
export function shareFilename(spec: {
  format?: string;
  entity: string;
  key?: string;
}) {
  if (spec.format === 'trophy-card')
    return `uglydex-${spec.entity}-${spec.key ?? 'achievement'}-card.png`;
  if (spec.format === 'collector-card')
    return `uglydex-${spec.entity}-collector-card.png`;
  return spec.format === 'trading-card'
    ? `squigs-reloaded-${spec.entity}-trading-card.png`
    : 'uglydex.png';
}
