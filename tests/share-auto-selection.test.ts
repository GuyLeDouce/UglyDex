import { expect, it } from 'vitest';
import {
  favoriteFirst,
  rankedShareAchievements,
  rankedShareSets,
} from '../src/server/share-selection';
import { shareCapacity } from '../src/domain/share-capacity';
it('keeps favorites in order then fills with ranked unique Squigs', () => {
  expect(favoriteFirst([8, 3, 6], [3, 1, 8, 2, 4, 5], 6)).toEqual([
    8, 3, 6, 1, 2, 4,
  ]);
  expect(favoriteFirst([], [9, 2], 12)).toEqual([9, 2]);
  expect(favoriteFirst([], [], 6)).toEqual([]);
});
it('chooses the highest earned family tier before applying the shape limit', () => {
  const earned = [
    'collector-discoveries-1',
    'collector-discoveries-50',
    'collector-duels-1',
  ].map((key) => ({ key }));
  expect(rankedShareAchievements(earned, 1).map((a) => a.key)).toEqual([
    'collector-discoveries-50',
  ]);
  expect(rankedShareAchievements(earned, 14)).toHaveLength(2);
});
it('selects the highest completed threshold in each set family', () => {
  const rows = [
    { key: 'first-specimen', difficulty: 'Easy', required: 1 },
    { key: 'deep-archive', difficulty: 'Hard', required: 100 },
    { key: 'unrelated', difficulty: 'Insane', required: 1 },
  ];
  expect(rankedShareSets(rows, 18).map((s) => s.key)).toEqual([
    'unrelated',
    'deep-archive',
  ]);
  expect(rankedShareSets(rows, 1).map((s) => s.key)).toEqual(['unrelated']);
  expect(rows).toHaveLength(3);
});
it('allocates larger square card budgets without exceeding the renderer', () => {
  expect(shareCapacity('landscape')).toEqual({
    achievements: 8,
    sets: 9,
    squigs: 6,
  });
  expect(shareCapacity('square')).toEqual({
    achievements: 14,
    sets: 21,
    squigs: 12,
  });
});
