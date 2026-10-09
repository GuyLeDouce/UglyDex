import { readFile } from 'node:fs/promises';
import { chromium, type Browser } from '@playwright/test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SquigCard } from '../src/components/collection';
import type { SquigCardData } from '../src/server/collections';

const visualStylesheet = await readFile(
  new URL('../src/app/visual.css', import.meta.url),
  'utf8',
);
let browser: Browser;

beforeAll(async () => {
  browser = await chromium.launch({ headless: true });
});

afterAll(async () => {
  await browser.close();
});

function cardClass(rarity?: string | null) {
  const item = {
    tokenId: 7,
    name: 'Squig #7',
    image: null,
    uglyPoints: null,
    mawRank: null,
    rarity,
    og: false,
    legendary: false,
    traits: [],
  } as SquigCardData;
  const html = renderToStaticMarkup(
    createElement(SquigCard, { item, priority: false }),
  );
  return html.match(/class="([^"]*\bsquig-card\b[^"]*)"/)?.[1];
}

describe('Squig card rarity colors', () => {
  it.each([
    ['common', 'rarity-common'],
    ['uncommon', 'rarity-uncommon'],
    ['rare', 'rarity-rare'],
    ['epic', 'rarity-epic'],
    ['legendary', 'rarity-legendary'],
  ])('maps %s rarity to %s', (rarity, className) => {
    expect(cardClass(rarity)).toContain(className);
  });

  it('normalizes case and surrounding whitespace', () => {
    expect(cardClass('  RaRe  ')).toContain('rarity-rare');
  });

  it.each([undefined, null, '', 'mythic', 'Rare special'])(
    'uses the unclassified class for unsupported rarity %s',
    (rarity) => {
      expect(cardClass(rarity)).toContain('rarity-unclassified');
    },
  );

  it('keeps the same rarity class when cards move to another grid position', () => {
    const firstOrder = ['common', 'rare', 'epic'].map(cardClass);
    const shiftedOrder = ['uncommon', 'common', 'rare', 'epic'].map(cardClass);

    expect(shiftedOrder[1]).toBe(firstOrder[0]);
    expect(shiftedOrder[2]).toBe(firstOrder[1]);
    expect(shiftedOrder[3]).toBe(firstOrder[2]);
  });

  it('uses rarity selectors for card colors instead of grid-position selectors', () => {
    expect(visualStylesheet).not.toMatch(/\.squig-card:nth-child\(/);
    for (const rarity of [
      'common',
      'uncommon',
      'rare',
      'epic',
      'legendary',
      'unclassified',
    ]) {
      expect(visualStylesheet).toMatch(
        new RegExp(
          `\\.squig-card\\.rarity-${rarity}\\s*\\{[^}]*background:`,
          's',
        ),
      );
    }
  });

  it('renders distinct rarity backgrounds with dark readable card text', async () => {
    const page = await browser.newPage();
    await page.setContent(`
      <style>${visualStylesheet}</style>
      <div class="squig-card rarity-common"><div class="card-body"><div class="card-title"><h3>Squig #1</h3><span class="rarity">Common</span></div><div class="card-numbers"><span><strong>1,000</strong> UP</span><span>Rank 1</span></div><div class="tags"><span>OG</span></div><p class="ownership-label">Currently Owned</p></div></div>
      <div class="squig-card rarity-uncommon"></div>
      <div class="squig-card rarity-rare"></div>
      <div class="squig-card rarity-epic"></div>
      <div class="squig-card rarity-legendary"></div>
      <div class="squig-card rarity-unclassified"></div>
    `);

    const styles = await page.locator('.squig-card').evaluateAll((cards) =>
      cards.map((card) => ({
        background: getComputedStyle(card).backgroundImage,
        color: getComputedStyle(card).color,
      })),
    );

    expect(styles.map((style) => style.background)).toEqual([
      expect.stringContaining('rgb(247, 247, 243)'),
      expect.stringContaining('rgb(191, 245, 201)'),
      expect.stringContaining('rgb(217, 236, 255)'),
      expect.stringContaining('rgb(239, 233, 255)'),
      expect.stringContaining('rgb(255, 243, 176)'),
      expect.stringContaining('rgb(236, 238, 241)'),
    ]);
    expect(new Set(styles.map((style) => style.background)).size).toBe(6);
    expect(styles.every((style) => style.color === 'rgb(17, 19, 24)')).toBe(
      true,
    );

    const darkText = await page
      .locator('.rarity, .card-numbers, .tags span, .ownership-label')
      .evaluateAll((elements) =>
        elements.every(
          (element) => getComputedStyle(element).color !== 'rgb(255, 255, 255)',
        ),
      );
    expect(darkText).toBe(true);
    await page.close();
  });
});
