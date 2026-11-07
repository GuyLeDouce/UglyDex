import {
  tradingCardPalettes,
  TRADING_BAR_INK,
} from '../src/domain/trading-card-palette';
import { expect, it } from 'vitest';
import {
  cardFinishes,
  clampPose,
  loopPose,
  parseCardFinish,
} from '../src/domain/card-finish';
it('keeps OG independent and defaults missing metadata safely', () => {
  expect(parseCardFinish('rare', '1')).toEqual({ rarity: 'rare', og: true });
  expect(parseCardFinish('legendary', '0')).toEqual({
    rarity: 'legendary',
    og: false,
  });
  expect(parseCardFinish('OG', '1')).toEqual({
    rarity: 'unclassified',
    og: true,
  });
  expect(cardFinishes.common.foil).toBe(0);
  expect(cardFinishes.uncommon.foil).toBe(0);
  expect(cardFinishes.rare.foil).toBeLessThan(cardFinishes.epic.foil);
  expect(cardFinishes.epic.foil).toBeLessThan(cardFinishes.legendary.foil);
});
it('clamps interaction and produces a continuous restrained loop', () => {
  expect(clampPose(2)).toBe(1);
  expect(clampPose(-9)).toBe(-1);
  expect(loopPose(1).x).toBeCloseTo(loopPose(0).x);
  expect(loopPose(1).y).toBeCloseTo(loopPose(0).y);
  for (let i = 0; i < 100; i++) {
    const p = loopPose(i / 100);
    expect(Math.abs(p.x)).toBeLessThanOrEqual(0.85);
    expect(Math.abs(p.y)).toBeLessThanOrEqual(0.65);
  }
});

// Worst-case multiply attenuation bounds every RGB channel of the bar material.
it('keeps rarity bar text AA-readable even under the darkest foil', () => {
  const luminance = (hex: string, attenuation: number) => {
    const rgb = [1, 3, 5]
      .map((i) => (parseInt(hex.slice(i, i + 2), 16) / 255) * attenuation)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  };
  for (const palette of Object.values(tradingCardPalettes)) {
    expect(
      (luminance(palette.bar, 0.72) + 0.05) /
        (luminance(TRADING_BAR_INK, 1) + 0.05),
    ).toBeGreaterThanOrEqual(4.5);
  }
});
