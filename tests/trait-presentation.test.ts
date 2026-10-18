import { describe, expect, it } from 'vitest';
import { rarestTraitsFirst } from '../src/server/trait-presentation';
import { traitCatalog } from '../src/domain/dex-catalog';
import { collectionOrder, filterSchema } from '../src/domain/collection';

describe('card trait presentation', () => {
  it('orders canonical traits by frequency without changing the input', () => {
    const catalog = [...traitCatalog].sort((a, b) => a.count - b.count);
    const rare = catalog[0],
      common = catalog.at(-1)!;
    const traits = [common, rare].map((t) => ({
      traitType: t.type,
      value: t.value,
    }));
    expect(rarestTraitsFirst(traits)).toEqual([traits[1], traits[0]]);
    expect(traits[0].value).toBe(common.value);
  });
  it('keeps unknown traits last and ties stable', () => {
    const known = traitCatalog[0];
    const input = [
      { traitType: 'Z', value: 'unknown' },
      { traitType: known.type, value: known.value },
      { traitType: 'A', value: 'unknown' },
    ];
    expect(rarestTraitsFirst(input)).toEqual([input[1], input[2], input[0]]);
  });
  it('supports descending Maw Rank with missing ranks last and a token tie-break', () => {
    expect(filterSchema.parse({ sort: 'rank-desc' }).sort).toBe('rank-desc');
    expect(collectionOrder('rank-desc')).toEqual([
      { mawRank: { sort: 'desc', nulls: 'last' } },
      { tokenId: 'asc' },
    ]);
  });
});
