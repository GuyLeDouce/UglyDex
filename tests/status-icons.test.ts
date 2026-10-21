import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { personalStatusIcons } from '../src/domain/status-icons';
import { matchingSetIcons } from '../src/domain/set-icons';
import { collectionSets } from '../src/domain/dex-catalog';
import approved from '../src/domain/approved-icons.json';
import type { DexToken } from '../src/domain/dex';
const token: DexToken = {
  tokenId: 1,
  traits: { Skin: 'Purple' },
  og: false,
  legendary: false,
  rarityTier: 'Common',
};
const candidate = {
  owned: false,
  discovered: false,
  missingTraits: 1,
  sets: ['first-specimen', 'field-notes'],
};
describe('approved artwork and status indicators', () => {
  it('ships all 66 original PNGs with a unique mapping', () => {
    expect(approved).toHaveLength(66);
    expect(new Set(approved.map((a) => a.path)).size).toBe(66);
    for (const icon of approved) {
      const png = readFileSync(`public${icon.path}`);
      expect(png.subarray(1, 4).toString()).toBe('PNG');
      expect(png.readUInt32BE(16)).toBe(64);
      expect(png.readUInt32BE(20)).toBe(64);
    }
    for (const icon of matchingSetIcons(token, collectionSets))
      expect(
        approved.some((a) => a.path === icon.icon && a.key === icon.key),
      ).toBe(true);
  });
  it('only calls a set complete when all requirements finish', () => {
    const icons = personalStatusIcons(token, candidate, [], [], []);
    expect(icons.find((i) => i.key === 'completes-set')?.description).toContain(
      'First Specimen',
    );
    expect(
      icons.find((i) => i.key === 'completes-set')?.description,
    ).not.toContain('Field Notes');
    expect(icons.map((i) => i.key)).toEqual(
      expect.arrayContaining([
        'new-discovery',
        'missing-trait',
        'advances-set',
      ]),
    );
  });
  it('does not claim a completed or already owned discovery as new completion', () => {
    const icons = personalStatusIcons(
      token,
      {
        ...candidate,
        owned: true,
        discovered: true,
        missingTraits: 0,
        sets: [],
      },
      [token],
      [token],
      [],
    );
    expect(icons.map((i) => i.key)).toEqual(['currently-owned']);
  });
  it('uses holding evidence for current sets, rather than historical discoveries', () => {
    const icons = personalStatusIcons(
      token,
      { ...candidate, discovered: true, sets: ['room-for-one'] },
      [token],
      [],
      [],
    );
    expect(icons.map((i) => i.key)).toContain('previously-owned');
    expect(icons.find((i) => i.key === 'completes-set')?.description).toContain(
      'Room for One',
    );
  });
  it('matches featured sets without requiring advancement and never exposes hidden sets', () => {
    const icons = personalStatusIcons(
      token,
      { ...candidate, sets: [] },
      [token],
      [],
      ['purple-people', 'quiet-room'],
    );
    expect(icons.find((i) => i.key === 'featured-set')?.description).toContain(
      'Purple People Eater',
    );
    expect(JSON.stringify(icons)).not.toContain('Quiet Room');
  });
});
