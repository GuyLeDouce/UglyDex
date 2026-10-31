import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { squigOpenSeaUrl } from '../../src/domain/opensea';
import { openSeaSortTests } from './opensea-sort';

export async function openSeaWebTests(
  base: string,
  check: (v: unknown, m: string) => void,
  browserTests: boolean,
) {
  await openSeaSortTests(check);
  const response = await fetch(base + '/api/opensea/listings');
  check(
    response.ok && response.headers.get('cache-control') === 'no-store',
    'listing endpoint is public and not cached downstream',
  );
  check(
    (await response.json()).status === 'unavailable',
    'missing OpenSea key is unavailable rather than a false unlisted result',
  );
  const html = await (await fetch(base + '/squigs/listings')).text();
  check(
    html.includes('Listings are temporarily unavailable.') &&
      html.includes('https://opensea.io/collection/squigs-reloaded'),
    'listing browse page keeps the direct collection link during an outage',
  );
  if (!browserTests) return;
  await mkdir('.data/opensea', { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const path of ['/squigs', '/squigs/listings']) {
        await page.goto(base + path);
        await page
          .getByLabel('Sort', { exact: true })
          .selectOption('price-desc');
        await page
          .getByRole('button', { name: 'Apply filters', exact: true })
          .click();
        await page.waitForURL(
          (url) => url.searchParams.get('sort') === 'price-desc',
        );
        check(
          (await page.getByLabel('Sort', { exact: true }).inputValue()) ===
            'price-desc',
          `price sort remains selected on ${path} at ${width}px`,
        );
        check(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          `price sort controls fit ${path} at ${width}px`,
        );
        await page
          .getByText('Listings are temporarily unavailable.', { exact: true })
          .waitFor();
        if (path === '/squigs/listings') {
          for (const sort of [
            'points-desc',
            'points-asc',
            'rank',
            'rank-desc',
          ]) {
            await page.getByLabel('Sort', { exact: true }).selectOption(sort);
            await page
              .getByRole('button', { name: 'Apply filters', exact: true })
              .click();
            await page.waitForURL(
              (url) => url.searchParams.get('sort') === sort,
            );
            check(
              (await page.getByLabel('Sort', { exact: true }).inputValue()) ===
                sort,
              `${sort} remains selected for listed results at ${width}px`,
            );
          }
        }
      }
    }
    let available = true;
    let listed = true;
    await page.route('**/api/opensea/listings', (route) =>
      route.fulfill({
        json: available
          ? {
              status: 'available',
              complete: true,
              checkedAt: new Date().toISOString(),
              listings: listed
                ? [
                    {
                      tokenId: 4398,
                      amount: '0.0014',
                      currency: 'ETH',
                      expiresAt: new Date(Date.now() + 3600000).toISOString(),
                    },
                  ]
                : [],
            }
          : {
              status: 'unavailable',
              complete: false,
              checkedAt: null,
              listings: [],
            },
      }),
    );
    for (const width of [1440, 390, 320]) {
      listed = true;
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(base + '/squigs?q=4398');
      // Compact mode persists across navigation and hides prices on mobile.
      // Exercise full price text in Grid, then test Compact separately below.
      await page.getByRole('button', { name: '▦ Grid', exact: true }).click();
      const card = page
        .locator('.squig-card')
        .filter({ has: page.locator('a[href="/squig/4398"]') });
      await card.locator('.opensea-price strong').waitFor();
      check(
        (await card.locator('.opensea-price').innerText()).includes(
          '0.0014 ETH',
        ),
        `listed card displays API asking price at ${width}px`,
      );
      const external = card.getByRole('link', {
        name: 'View Squig #4398 on OpenSea (opens in a new tab)',
        exact: true,
      });
      check(
        (await external.getAttribute('href')) === squigOpenSeaUrl(4398),
        'card links to the canonical Reloaded token',
      );
      check(
        (await page.locator('a a').count()) === 0,
        'marketplace links never nest inside card links',
      );
      await external.focus();
      check(
        await external.evaluate((el) => el === document.activeElement),
        'marketplace link is keyboard accessible',
      );
      check(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
        `marketplace card fits ${width}px`,
      );
      await card.screenshot({ path: `.data/opensea/listed-card-${width}.png` });
      await page
        .getByRole('button', { name: '▤ Compact', exact: true })
        .click();
      check(
        (await external.isVisible()) &&
          (await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          )),
        `compact marketplace card fits ${width}px`,
      );
      await card.locator('.squig-card-main').click();
      await page.waitForURL('**/squig/4398');
      await page.locator('.opensea-detail .opensea-price strong').waitFor();
      check(
        (await page.locator('.opensea-detail').innerText()).includes(
          '0.0014 ETH',
        ),
        'detail page has the same token listing',
      );
      check(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
        `marketplace detail fits ${width}px`,
      );
      await page
        .locator('.specimen')
        .screenshot({ path: `.data/opensea/listed-detail-${width}.png` });
      const traits = await page
        .locator('#traits .trait strong')
        .allTextContents();
      check(
        traits.length === 8 &&
          traits.includes('Beige Elf') &&
          traits.every(
            (value) =>
              value.trim() && !/^(none|not recorded)$/i.test(value.trim()),
          ),
        `detail hides absent traits while retaining real traits at ${width}px`,
      );
      listed = false;
      await page.reload();
      await page.getByText('Unlisted', { exact: true }).waitFor();
      check(
        (await page.locator('.opensea-detail .opensea-price').innerText()) ===
          'Unlisted',
        `unlisted detail uses the concise label at ${width}px`,
      );
      await page.goto(base + '/squigs?q=4398');
      await page.getByRole('button', { name: '▦ Grid', exact: true }).click();
      await card.getByText('Unlisted', { exact: true }).waitFor();
      check(
        (await card.locator('.opensea-price').innerText()) === 'Unlisted',
        `unlisted card uses the concise label at ${width}px`,
      );
    }
    available = false;
    await page.goto(base + '/squig/4398');
    await page.getByText('Listings unavailable', { exact: true }).waitFor();
    check(
      await page
        .getByRole('link', {
          name: 'View Squig #4398 on OpenSea (opens in a new tab)',
          exact: true,
        })
        .isVisible(),
      'OpenSea token link remains available when listing fetch fails',
    );
    check(
      (await page.locator('.opensea-price strong').count()) === 0,
      'outage never retains a stale asking price',
    );
  } finally {
    await browser.close();
  }
}
