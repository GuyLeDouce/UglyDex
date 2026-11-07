import type { CardRarity } from './trading-card';
export const tradingCardPalettes: Record<
  CardRarity,
  { light: string; mid: string; dark: string; ink: string }
> = {
  common: { light: '#f4f8fc', mid: '#a4b3bd', dark: '#43535d', ink: '#26343c' },
  uncommon: {
    light: '#e5ffd0',
    mid: '#74d978',
    dark: '#176a40',
    ink: '#123f2c',
  },
  rare: { light: '#dff8ff', mid: '#5caef1', dark: '#164f9b', ink: '#153963' },
  epic: { light: '#f4e3ff', mid: '#bd7bef', dark: '#6531a1', ink: '#40255e' },
  legendary: {
    light: '#fff4bd',
    mid: '#edc449',
    dark: '#8a5c12',
    ink: '#49320e',
  },
  unclassified: {
    light: '#f0f1ef',
    mid: '#b9bcb7',
    dark: '#555d57',
    ink: '#303933',
  },
};
