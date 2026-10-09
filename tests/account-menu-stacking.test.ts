import { readFile } from 'node:fs/promises';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from '@playwright/test';

const stylesheet = await readFile(
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

async function renderHeader(page: Page) {
  await page.setContent(`
    <style>${stylesheet}</style>
    <header class="site-header">
      <a class="brand-mark" href="/">UglyDex</a>
      <nav class="primary-nav" aria-label="Primary navigation">
        <a href="/me">My UglyDex</a><a href="/squigs">Explore</a>
      </nav>
      <div class="header-account">
        <details class="account-menu">
          <summary>My account</summary>
          <nav aria-label="Account navigation">
            <a href="/collection">Collection</a>
            <a href="/charm">$CHARM</a>
            <button type="button">Sign out</button>
          </nav>
        </details>
      </div>
      <details class="mobile-menu">
        <summary aria-label="Toggle site navigation">Menu</summary>
        <nav aria-label="Mobile navigation">
          <a href="/me">My UglyDex</a>
          <a href="/collection">Collection</a>
          <a href="/charm">$CHARM</a>
          <button type="button">Sign out</button>
        </nav>
      </details>
    </header>
    <main id="main" style="position:relative;z-index:1;margin-top:-18px">
      <section style="min-height:520px;padding:40px;background:#fff;color:#111">
        Main page board
      </section>
    </main>
    <script>
      document.addEventListener('click', (event) => {
        const link = event.target.closest('a');
        if (link) {
          event.preventDefault();
          document.body.dataset.clicked = link.getAttribute('href');
        }
        if (event.target.closest('button')) {
          event.preventDefault();
          document.body.dataset.signout = 'clicked';
        }
      });
    </script>
  `);
}

describe('account menu stacking', () => {
  it('keeps desktop account links above the page board and clickable', async () => {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
    });
    await renderHeader(page);
    await page.locator('.account-menu > summary').click();

    const menu = page.locator('.account-menu > nav');
    const link = menu.getByRole('link', { name: 'Collection' });
    const [menuBox, mainBox, shadow, hit] = await Promise.all([
      menu.boundingBox(),
      page.locator('main').boundingBox(),
      menu.evaluate((node) => getComputedStyle(node).boxShadow),
      link.evaluate((node) => {
        const rect = node.getBoundingClientRect();
        return (
          document
            .elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
            ?.closest('a[href="/collection"]') !== null
        );
      }),
    ]);

    expect(menuBox).not.toBeNull();
    expect(mainBox).not.toBeNull();
    expect(menuBox!.y + menuBox!.height).toBeGreaterThan(mainBox!.y);
    expect(shadow).not.toBe('none');
    expect(hit).toBe(true);

    await link.hover();
    expect(
      await link.evaluate((node) => getComputedStyle(node).backgroundColor),
    ).toBe('rgb(239, 233, 255)');
    await page.locator('.account-menu > summary').focus();
    await page.keyboard.press('Tab');
    expect(
      await page.evaluate(
        () => document.activeElement?.getAttribute('href') === '/collection',
      ),
    ).toBe(true);
    expect(
      await link.evaluate((node) => getComputedStyle(node).outlineStyle),
    ).toBe('solid');
    await link.click();
    expect(await page.locator('body').getAttribute('data-clicked')).toBe(
      '/collection',
    );
    await menu.getByRole('button', { name: 'Sign out' }).click();
    expect(await page.locator('body').getAttribute('data-signout')).toBe(
      'clicked',
    );

    await page.close();
  });

  it('keeps the mobile disclosure menu unclipped, above content, and keyboard operable', async () => {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
    });
    await renderHeader(page);
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    expect(
      await page.evaluate(() =>
        document.activeElement?.matches('.mobile-menu > summary'),
      ),
    ).toBe(true);
    await page.keyboard.press('Space');

    const menu = page.locator('.mobile-menu > nav');
    const link = menu.getByRole('link', { name: 'Collection' });
    expect(await menu.isVisible()).toBe(true);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390);
    expect(
      await link.evaluate((node) => {
        const rect = node.getBoundingClientRect();
        return (
          document
            .elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
            ?.closest('a[href="/collection"]') !== null
        );
      }),
    ).toBe(true);

    await page.keyboard.press('Tab');
    expect(
      await page.evaluate(
        () => (document.activeElement as HTMLAnchorElement | null)?.href,
      ),
    ).toContain('/me');
    await page.keyboard.press('Tab');
    expect(
      await page.evaluate(
        () => (document.activeElement as HTMLAnchorElement | null)?.href,
      ),
    ).toContain('/collection');
    await page.keyboard.press('Enter');
    expect(await page.locator('body').getAttribute('data-clicked')).toBe(
      '/collection',
    );

    await page.close();
  });
});
