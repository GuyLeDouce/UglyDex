import { expect, it } from 'vitest';
import { highestFamilyBadges } from '../src/server/achievement-badges';
it('selects the highest earned threshold from each family instead of duplicate artwork', () => {
  const earned = [
    'collector-discoveries-1',
    'collector-discoveries-50',
    'collector-discoveries-5',
    'collector-duels-1',
    'collector-duels-10',
    'collector-wins-1',
  ].map((key) => ({ key }));
  expect(highestFamilyBadges(earned).map((a) => a.key)).toEqual([
    'collector-discoveries-50',
    'collector-duels-10',
    'collector-wins-1',
  ]);
  expect(highestFamilyBadges(earned, 2)).toHaveLength(2);
});
it('does not introduce unearned achievements or merge Collector and Squig families', () => {
  expect(highestFamilyBadges([])).toEqual([]);
  const earned = ['collector-duels-1', 'squig-duels-1'].map((key) => ({ key }));
  expect(highestFamilyBadges(earned)).toEqual(earned);
});
