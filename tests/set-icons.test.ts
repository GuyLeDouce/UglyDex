import { describe, expect, it } from 'vitest';
import { matchingSetIcons, setIcons } from '../src/domain/set-icons';
import { collectionSets } from '../src/domain/dex-catalog';
import type { DexToken } from '../src/domain/dex';
const token: DexToken = {
  tokenId: 1,
  og: false,
  legendary: false,
  rarityTier: 'Common',
  traits: { Skin: 'Robot', Body: 'White Astronaut' },
};
const keys = (t: DexToken) =>
  matchingSetIcons(t, collectionSets).map((s) => s.key);
describe('potential set membership icons', () => {
  it('matches individual requirements without requiring a completed set or an owner', () => {
    expect(keys(token)).toContain('machine-learning');
    expect(keys(token)).toContain('space-program');
    expect(keys(token)).not.toContain('amphibian-atlas');
    expect(keys(token)).not.toContain('og-curious');
  });
  it('includes broad collection milestones but requires a value for trait variety', () => {
    expect(keys(token)).toContain('deep-archive');
    expect(keys(token)).toContain('colour-clash');
    expect(keys(token)).not.toContain('eyes-wide');
  });
  it('does not reveal hidden sets even for matching tokens', () => {
    expect(keys({ ...token, traits: { Mouth: 'Sewn' } })).not.toContain(
      'quiet-room',
    );
  });
  it('uses OG and legendary flags and gives specific matches priority', () => {
    const result = keys({ ...token, og: true, legendary: true });
    expect(result).toContain('og-curious');
    expect(result).toContain('legendary-encounter');
    expect(result.indexOf('machine-learning')).toBeLessThan(
      result.indexOf('deep-archive'),
    );
  });
  it('has a themed icon for every catalog set', () => {
    expect(collectionSets.filter((s) => !setIcons[s.key])).toEqual([]);
  });
});
