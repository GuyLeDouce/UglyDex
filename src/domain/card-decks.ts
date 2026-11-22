export const cardDecks = [
  'common',
  'uncommon',
  'rare',
  'epic',
  'legendary',
] as const;
export type CardDeck = (typeof cardDecks)[number];
export function masteryDeck(percent: number): CardDeck {
  if (percent >= 91) return 'legendary';
  if (percent >= 66) return 'epic';
  if (percent >= 41) return 'rare';
  if (percent >= 26) return 'uncommon';
  return 'common';
}
