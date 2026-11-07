import type { CardRarity } from './trading-card';

// Presentation only: never infer or change the indexed rarity or OG status.
export const cardFinishes: Record<
  CardRarity,
  { label: string; foil: number; sheen: number; facets: number }
> = {
  common: { label: 'Matte print', foil: 0, sheen: 0.07, facets: 0 },
  uncommon: { label: 'Satin metal', foil: 0, sheen: 0.22, facets: 0 },
  rare: { label: 'Spectrum foil', foil: 0.38, sheen: 0.25, facets: 1 },
  epic: { label: 'Prismatic foil', foil: 0.52, sheen: 0.32, facets: 2 },
  legendary: { label: 'Legendary prism', foil: 0.62, sheen: 0.38, facets: 3 },
  unclassified: { label: 'Standard print', foil: 0, sheen: 0.07, facets: 0 },
};
export type CardFinish = { rarity: CardRarity; og: boolean };
export function parseCardFinish(
  rarity: string | null,
  og: string | null,
): CardFinish {
  return {
    rarity:
      rarity && Object.hasOwn(cardFinishes, rarity)
        ? (rarity as CardRarity)
        : 'unclassified',
    og: og === '1',
  };
}
export type CardPose = { x: number; y: number };
export const clampPose = (value: number) => Math.max(-1, Math.min(1, value));
export function loopPose(progress: number): CardPose {
  const angle = progress * Math.PI * 2;
  return { x: Math.sin(angle) * 0.6, y: Math.cos(angle) * 0.4 };
}
export function recordingType(supported: (type: string) => boolean) {
  return (
    [
      'video/mp4;codecs=avc1.424028',
      'video/mp4',
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
    ].find(supported) ?? null
  );
}
