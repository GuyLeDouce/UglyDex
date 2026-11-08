import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CardDiscovery } from '../src/components/card-discovery';
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
    expect(html.indexOf('Advances 2 sets')).toBeLessThan(
      html.indexOf('<details'),
    );
    expect(html.indexOf('album-progress')).toBeGreaterThan(
      html.indexOf('trading-face-inner'),
    );
    expect(html.indexOf('album-progress')).toBeGreaterThan(
      html.indexOf('</a>'),
    );
    expect(html).toContain('Adds 3 missing traits');
  });
});

for (const compact of [false, true]) {
  it(`offers the collector-card shortcut only with viewer eligibility (${compact ? 'compact' : 'grid'})`, () => {
    const publicHtml = renderToStaticMarkup(
      createElement(SquigCard, {
        item: { ...item, currentlyOwned: true },
        compact,
      }),
    );
    expect(publicHtml).not.toContain('/collector-card');
    const ownerHtml = renderToStaticMarkup(
      createElement(SquigCard, {
        item,
        compact,
        collectorCard: true,
      }),
    );
    expect(ownerHtml).toContain('href="/squig/1/collector-card"');
    expect(ownerHtml).toContain('Download Collector Card for Squig #1');
    expect(ownerHtml).not.toMatch(
      /<a[^>]*squig-card-main[^>]*>(?:(?!<\/a>)[\s\S])*collector-card-link/,
    );
  });
}

describe('integrated discovery context', () => {
  it('uses current verified ownership ahead of a lagging snapshot', () => {
    const html = renderToStaticMarkup(
      createElement(CardDiscovery, { item, viewerOwned: true }),
    );
    expect(html).toContain('data-discovery="owned"');
    expect(html).not.toContain('New to your Dex');
    expect(html).toContain('Why this helps your Dex');
    expect(html).toContain('does not necessarily complete');
  });
  it('does not label another collector’s holding as mine', () => {
    const html = renderToStaticMarkup(
      createElement(CardDiscovery, {
        item: { ...item, currentlyOwned: true },
        viewerOwned: false,
      }),
    );
    expect(html).toContain('New to your Dex');
    expect(html).not.toContain('data-discovery="owned"');
  });
  it('distinguishes a past discovery from an undiscovered token', () => {
    const html = renderToStaticMarkup(
      createElement(CardDiscovery, {
        item: {
          ...item,
          personalization: { ...item.personalization!, discovered: true },
        },
        viewerOwned: false,
      }),
    );
    expect(html).toContain('Previously discovered');
  });
});
