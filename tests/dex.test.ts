import { describe, it, expect } from 'vitest';
import {
  COLLECTION_RULESET,
  buildTraitCatalog,
  normalizeTrait,
  decodeTraitSlug,
  traitPath,
  tokenTraits,
  discoverTraits,
  evaluateRequirement,
  evaluateSet,
  completion,
  advances,
  type DexToken,
} from '../src/domain/dex';
import {
  collectionSets,
  traitCatalog,
  canonicalTokens,
  verifyCatalog,
} from '../src/domain/dex-catalog';
import { candidateMap } from '../src/server/dex-engine';
import { setProjection } from '../src/server/dex';
const token = (
  id: number,
  traits: Record<string, string> = {},
  at = '2026-01-01T00:00:00.000Z',
): DexToken => ({
  tokenId: id,
  traits,
  og: false,
  legendary: false,
  rarityTier: 'common',
  at,
  evidence: `period-${id}`,
});
const set = (key: string) => collectionSets.find((s) => s.key === key)!;
describe('versioned collection catalog', () => {
  it('pins a separate collection version', () =>
    expect(COLLECTION_RULESET).toBe('uglydex-collection-v1'));
  it('has 345 canonical values in eight categories', () => {
    expect(traitCatalog).toHaveLength(345);
    expect(new Set(traitCatalog.map((t) => t.type)).size).toBe(8);
  });
  it('normalizes whitespace without inventing names', () => {
    expect(normalizeTrait(' Diving Suit\r\n')).toBe('Diving Suit');
    expect(normalizeTrait('Super Gold ')).toBe('Super Gold');
  });
  it('excludes technical fields, classification and Legend names', () =>
    expect(
      tokenTraits(
        token(1, {
          Legend: 'Cornhuglyio',
          Status: 'OG',
          tokenId: '1',
          Skin: 'Purple',
        }),
      ),
    ).toHaveLength(1));
  it('keeps canonical None', () =>
    expect(tokenTraits(token(1, { Special: 'None' }))[0].value).toBe('None'));
  it('legendary empty metadata does not invent normal traits', () =>
    expect(tokenTraits(canonicalTokens.find((t) => t.legendary)!)).toEqual([]));
  it('deduplicates tokens', () =>
    expect(
      buildTraitCatalog([
        token(1, { Eyes: 'Triple' }),
        token(1, { Eyes: 'Triple' }),
      ])[0].count,
    ).toBe(1));
  it('catalog frequency denominator is 4444', () =>
    expect(
      buildTraitCatalog([token(1, { Eyes: 'Triple' })])[0].percentage,
    ).toBe(100 / 4444));
  it('encodes unsafe trait URL characters', () =>
    expect(traitPath('Head', 'a/b?c')).toBe('/traits/Head/a%2Fb%3Fc'));
  it('has no invalid references', () => expect(verifyCatalog()).toEqual([]));
  it('contains 39 historical, 13 current and 3 hidden sets', () => {
    expect(
      collectionSets.filter((s) => s.mode === 'HISTORICAL_DISCOVERY'),
    ).toHaveLength(39);
    expect(
      collectionSets.filter((s) => s.mode === 'CURRENT_HOLDING'),
    ).toHaveLength(13);
    expect(collectionSets.filter((s) => s.hidden)).toHaveLength(3);
  });
  for (const s of collectionSets)
    it(`${s.key} is feasible and deterministic`, () => {
      const a = evaluateSet(s, canonicalTokens);
      expect(a.complete).toBe(true);
      expect(evaluateSet(s, [...canonicalTokens].reverse())).toEqual(a);
    });
});
describe('evidence and sets', () => {
  it('decodes trait paths containing spaces', () =>
    expect(decodeTraitSlug('Diving%20Suit')).toBe('Diving Suit'));
  it('rejects malformed percent escapes', () =>
    expect(decodeTraitSlug('%zz')).toBe(''));
  it('normalization deduplicates equivalent trait keys', () =>
    expect(
      tokenTraits(token(1, { Eyes: 'Triple', ' Eyes ': ' Triple ' })),
    ).toHaveLength(1));
  it('first trait evidence uses date then token', () => {
    const a = token(9, { Skin: 'Purple' }),
      b = token(1, { Skin: 'Purple' });
    expect(discoverTraits([a, b]).get('Skin:Purple')?.tokenId).toBe(1);
  });
  it('invalidated discovery removes unsupported trait', () =>
    expect(discoverTraits([]).size).toBe(0));
  it('later evidence restores first discovery accurately', () => {
    const t = token(2, { Eyes: 'Triple' }, '2026-03-01');
    expect(discoverTraits([t]).get('Eyes:Triple')?.at).toBe('2026-03-01');
  });
  it('discovery needs evidence and timestamp', () =>
    expect(
      discoverTraits([{ ...token(1, { Eyes: 'Triple' }), evidence: undefined }])
        .size,
    ).toBe(0));
  it('count does not double duplicate tokens', () =>
    expect(
      evaluateRequirement({ kind: 'COUNT', count: 2 }, [token(1), token(1)])
        .complete,
    ).toBe(false));
  it('unique traits do not count duplicates or blanks', () =>
    expect(
      evaluateRequirement(
        { kind: 'UNIQUE_TRAIT_VALUES', traitType: 'Eyes', count: 2 },
        [
          token(1, { Eyes: 'Triple' }),
          token(2, { Eyes: 'Triple' }),
          token(3, { Eyes: '' }),
        ],
      ).count,
    ).toBe(1));
  it('exact IDs require all specified tokens', () =>
    expect(
      evaluateRequirement({ kind: 'TOKEN_IDS', count: 2, tokenIds: [1, 3] }, [
        token(1),
        token(2),
      ]).complete,
    ).toBe(false));
  it('compound filters apply to the same token', () =>
    expect(
      evaluateRequirement(
        {
          kind: 'COUNT',
          count: 1,
          filter: {
            traits: [
              { type: 'Skin', values: ['Purple'] },
              { type: 'Body', values: ['White Suit'] },
            ],
          },
        },
        [token(1, { Skin: 'Purple' }), token(2, { Body: 'White Suit' })],
      ).count,
    ).toBe(0));
  it('AND requirements can use different tokens', () =>
    expect(
      evaluateSet(
        set('suit-yourself'),
        ['White Suit', 'Black Suit', 'Brown Suit'].map((v, i) =>
          token(i + 1, { Body: v }),
        ),
      ).complete,
    ).toBe(true));
  it('OG and Legendary filters use canonical flags', () => {
    expect(
      evaluateSet(set('og-curious'), [{ ...token(1), og: true }]).complete,
    ).toBe(true);
    expect(
      evaluateSet(set('legendary-encounter'), [
        { ...token(1), legendary: true },
      ]).complete,
    ).toBe(true);
  });
  it('rarity classification is explicit', () =>
    expect(
      evaluateRequirement(
        { kind: 'COUNT', count: 1, filter: { rarity: 'epic' } },
        [token(1)],
      ).count,
    ).toBe(0));
  it('sale removes current completion while discovery remains', () => {
    expect(evaluateSet(set('room-for-one'), []).complete).toBe(false);
    expect(evaluateSet(set('first-specimen'), [token(1)]).complete).toBe(true);
  });
  it('historical completion has a qualifying timestamp', () =>
    expect(
      evaluateSet(
        set('field-notes'),
        [1, 2, 3, 4, 5].map((i) => token(i, {}, `2026-01-0${i}`)),
      ).at,
    ).toBe('2026-01-05'));
  it('unknown current acquisition time stays unknown', () =>
    expect(
      evaluateSet(set('room-for-one'), [{ ...token(1), at: undefined }]).at,
    ).toBeNull());
  it('partial progress can recover after evidence restoration', () => {
    const ts = [token(1)];
    expect(evaluateSet(set('first-specimen'), []).complete).toBe(false);
    expect(evaluateSet(set('first-specimen'), ts).complete).toBe(true);
  });
});
describe('completion and privacy', () => {
  it('zero state has zero score', () =>
    expect(completion(0, 0, 345, 0, 37).overall).toBe(0));
  it('full components equal 100', () =>
    expect(completion(4444, 345, 345, 37, 37).overall).toBe(100));
  it('uses explicit weights', () => {
    expect(completion(4444, 0, 345, 0, 37).overall).toBe(40);
    expect(completion(0, 345, 345, 0, 37).overall).toBe(35);
    expect(completion(0, 0, 345, 37, 37).overall).toBe(25);
  });
  it('caps and rounds deterministically', () =>
    expect(completion(1, 1, 345, 1, 37).overall).toBe(0.7861));
  it('current sets have no score argument', () =>
    expect(completion(0, 0, 345, 0, 37)).toEqual({
      squig: 0,
      trait: 0,
      sets: 0,
      overall: 0,
    }));
  it('hidden projections redact rules names counts and evidence', () => {
    const s = collectionSets.find((s) => s.hidden)!;
    const p = setProjection(s, undefined, true);
    expect(p.name).toBe('???');
    expect(p.requirements).toEqual([]);
    expect(p.required).toBe(0);
    expect(JSON.stringify(p)).not.toContain('Gold Terminator');
  });
  it('unlocked hidden projection reveals conditions', () => {
    const s = collectionSets.find((s) => s.hidden)!;
    expect(setProjection(s, evaluateSet(s, canonicalTokens), false).name).toBe(
      s.name,
    );
  });
  it('public evidence opt-out removes all qualifying token IDs', () =>
    expect(
      setProjection(
        set('first-specimen'),
        evaluateSet(set('first-specimen'), [token(1)]),
        false,
      ).requirements[0].tokens,
    ).toEqual([]));
  it('DTO never contains raw period evidence', () =>
    expect(
      JSON.stringify(
        setProjection(
          set('first-specimen'),
          evaluateSet(set('first-specimen'), [token(1)]),
          true,
        ),
      ),
    ).not.toContain('period-1'));
});
describe('batched explorer hints', () => {
  const tokens = [token(1, { Skin: 'Purple' }), token(2, { Skin: 'Green' })];
  it('flags owned/discovered and missing traits', () => {
    const c = candidateMap(tokens, [tokens[0]], [tokens[0]]);
    expect(c['1'].owned).toBe(true);
    expect(c['1'].missingTraits).toBe(0);
    expect(c['2'].discovered).toBe(false);
    expect(c['2'].missingTraits).toBe(1);
  });
  it('excludes hidden conditions from hints', () => {
    const c = candidateMap(canonicalTokens, [], []);
    for (const s of collectionSets.filter((s) => s.hidden))
      expect(Object.values(c).some((c) => c.sets.includes(s.key))).toBe(false);
  });
  it('does not advance a satisfied requirement', () =>
    expect(advances(set('first-specimen'), [tokens[0]], tokens[1])).toBe(
      false,
    ));
  it('does not advance an already counted token', () =>
    expect(advances(set('field-notes'), [tokens[0]], tokens[0])).toBe(false));
  it('counts a genuinely new unique value', () =>
    expect(advances(set('skin-deep'), [tokens[0]], tokens[1])).toBe(true));
});
