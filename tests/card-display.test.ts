import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TradingCardFace } from '../src/components/trading-card-face';
import { SquigCard } from '../src/components/collection';
import type { SquigCardData } from '../src/server/collections';

const item: SquigCardData = {
  tokenId: 1,
  name: 'Squig #1',
  image: null,
  rarity: 'epic',
  uglyPoints: 805,
  mawRank: 303,
  og: true,
  legendary: false,
  traits: [
    { traitType: 'Background', value: 'Green' },
    { traitType: 'Eyes', value: 'Triple' },
    { traitType: 'Head', value: 'Fresh Cut' },
    { traitType: 'Body', value: 'White Army Tee' },
    { traitType: 'Skin', value: 'Amphibian Red' },
    { traitType: 'Mouth', value: 'Smile' },
    { traitType: 'Special', value: 'None' },
    { traitType: 'Type', value: 'Amphibian' },
  ],
  personalization: {
    owned: false,
    discovered: false,
    missingTraits: 3,
    advances: 2,
  },
};
describe('collection display modes', () => {
  it('shows every meaningful Share Passport trait in canonical order', () => {
    const html = renderToStaticMarkup(createElement(TradingCardFace, { item }));
    for (const value of [
      'Fresh Cut',
      'White Army Tee',
      'Amphibian Red',
      'Triple',
      'Smile',
      'Green',
    ])
      expect(html).toContain(value);
    expect(html.indexOf('Fresh Cut')).toBeLessThan(
      html.indexOf('White Army Tee'),
    );
    expect(html).not.toContain('None');
    expect(html).toContain('Amphibian');
  });
  it('restores the original compact markup without a trading face or disclosure', () => {
    const html = renderToStaticMarkup(
      createElement(SquigCard, { item, compact: true }),
    );
    expect(html).toContain('card-body');
    expect(html).toContain('card-title');
    expect(html).not.toContain('trading-face');
    expect(html).not.toContain('album-card');
    expect(html).not.toContain('<details');
    expect(html).toContain('Advances 2 sets');
  });
  it('keeps discovery and set advancement visible outside grid details', () => {
    const html = renderToStaticMarkup(createElement(SquigCard, { item }));
    expect(html.indexOf('Advances 2 sets')).toBeGreaterThan(
      html.indexOf('</details>'),
    );
    expect(html).toContain('Adds 3 missing traits');
  });
});
