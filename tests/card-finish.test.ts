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
    expect(Math.abs(p.x)).toBeLessThanOrEqual(0.6);
    expect(Math.abs(p.y)).toBeLessThanOrEqual(0.4);
  }
});
