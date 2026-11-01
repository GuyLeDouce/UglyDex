import { expect, it } from 'vitest';
import {
  walletFieldGuide,
  rankCollectorRows,
} from '../src/domain/wallet-field-guide';
it('deduplicates current and historical tokens and ignores noncanonical IDs', () => {
  const view = walletFieldGuide([1, 1, 2, 0, 4445], [2, 3, 3]);
  expect(view.owned).toBe(2);
  expect(view.discovered).toBe(3);
  expect(view.discovered).toBeGreaterThanOrEqual(view.owned);
  expect(view.score.overall).toBeGreaterThan(0);
});
it('transfers change current sets without deleting historical wallet progress', () => {
  const before = walletFieldGuide([1], [1]);
  const after = walletFieldGuide([], [1]);
  expect(before.owned).toBe(1);
  expect(after.owned).toBe(0);
  expect(after.discovered).toBe(1);
  expect(after.score).toEqual(before.score);
  expect(
    after.sets.find((s) => s.definition.key === 'first-specimen')?.result
      .complete,
  ).toBe(true);
});
it('does not invent completion timestamps from observations', () => {
  expect(
    walletFieldGuide([1], []).sets.every((s) => s.result.at === null),
  ).toBe(true);
});
it('keeps equal scores tied, slug order stable, and missing evaluations visible', () => {
  const result = rankCollectorRows([
    { slug: 'b', overall: 10 },
    { slug: 'pending', overall: null },
    { slug: 'a', overall: 10 },
    { slug: 'c', overall: 2 },
  ]);
  expect(result.map((r) => [r.slug, r.rank])).toEqual([
    ['a', 1],
    ['b', 1],
    ['c', 2],
    ['pending', null],
  ]);
});
