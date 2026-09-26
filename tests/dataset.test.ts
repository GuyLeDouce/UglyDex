import { it, expect } from 'vitest';
import snapshot from '../data/squigs.json';
it('contains complete canonical data without recalculating scores', () => {
  expect(snapshot.records).toHaveLength(4444);
  expect(new Set(snapshot.records.map((r) => r.tokenId)).size).toBe(4444);
  expect(snapshot.records.filter((r) => r.legendary)).toHaveLength(31);
  expect(
    snapshot.records.filter((r) => r.legendary).every((r) => r.mawRank === 1),
  ).toBe(true);
  expect(snapshot.records.find((r) => r.tokenId === 1)).toMatchObject({
    uglyPoints: 805,
    og: true,
    traits: { Status: 'OG' },
  });
  expect(snapshot.sourceRevision).toBe(
    'a693d46c4a8ccaf663d8b308dee0a7578e1268e6',
  );
});
