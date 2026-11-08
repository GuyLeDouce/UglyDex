import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
import { db } from '../../src/server/db';
import { authHash } from '../../src/server/auth';
import { collectionPage } from '../../src/server/collections';
import { SQUIGS_CONTRACT } from '../../src/domain/validation';
import { squigArtwork } from '../../src/domain/assets';
import { stubArtwork } from './artwork-fixture';

// Runs last in the disposable database, never against a caller-selected DB.
export async function collectionAlbumWebTests(
  base: string,
  check: (v: unknown, m: string) => void,
  browserTests: boolean,
) {
  const wallet = '0x' + 'ac'.repeat(20);
  const c = await db().collector.create({
    data: {
      slug: 'album-review',
      displayName: 'Album Review',
      onboardingCompletedAt: new Date(),
      featuredTokenIds: [1300],
    },
  });
  await db().collectorWallet.create({
    data: {
      collectorId: c.id,
      walletAddress: wallet,
      chainId: 1,
      source: 'FIXTURE',
      verifiedAt: new Date(),
      status: 'ACTIVE',
    },
  });
  for (let tokenId = 1001; tokenId <= 1300; tokenId++) {
    const identity = { chainId: 1, contractAddress: SQUIGS_CONTRACT, tokenId };
    const s = await db().squig.upsert({
      where: { chainId_contractAddress_tokenId: identity },
      create: {
        ...identity,
        name: `Squig #${tokenId}`,
        rarityTier: 'rare',
        uglyPoints: 750,
        mawRank: tokenId,
        imageUrl: squigArtwork(tokenId),
      },
      update: {},
    });
    await db().squigOwnership.updateMany({
      where: { squigId: s.id },
      data: { isCurrent: false },
    });
    await db().squigOwnership.create({
      data: {
        squigId: s.id,
        walletAddress: wallet,
        isCurrent: true,
        blockNumber: 1n,
        blockHash: 'fixture-album',
        source: 'FIXTURE',
        sourceKey: `album:${tokenId}`,
      },
    });
  }
  const first = await collectionPage(
    { view: 'album', sort: 'favorites' },
    c.id,
    false,
    c.id,
  );
  check(
    first.total === 300 && first.pages === 50 && first.items.length === 6,
    '300 holdings use bounded six-card album pages',
  );
  check(
    first.items[0].tokenId === 1300,
    'favorite sorts first across the entire collection',
  );
  const last = await collectionPage(
    { view: 'album', sort: 'favorites', page: '999' },
    c.id,
    false,
    c.id,
  );
  // Schema rejects an excessive page; valid out-of-range pages clamp to last.
  const clamped = await collectionPage(
    { view: 'album', sort: 'favorites', page: '100' },
    c.id,
    false,
    c.id,
  );
  check(
    last.page === 1 && clamped.page === 50 && clamped.items.length === 6,
    'album page bounds remain safe',
  );
  const grid = await collectionPage({ view: 'compact' }, c.id, false, c.id);
  check(
    grid.items.length === 24 && grid.pageSize === 24,
    'compact pagination is preserved',
  );
  const search = await collectionPage(
    { q: '#1300', view: 'album' },
    c.id,
    false,
    c.id,
  );
  check(
    search.total === 1 && search.items[0].tokenId === 1300,
    'hash search works within owned collection',
  );
  const invalid = await collectionPage(
    { q: 'not a Squig link' },
    c.id,
    false,
    c.id,
  );
  check(
    invalid.searchError && invalid.total === 0,
    'invalid search never silently returns every owned Squig',
  );
  if (!browserTests) return;
  const token = randomBytes(32).toString('hex');
  await db().authSession.create({
    data: {
      tokenHash: authHash(token),
      collectorId: c.id,
      expiresAt: new Date(Date.now() + 3600000),
    },
  });
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      hasTouch: true,
    });
    await context.addCookies([
      { name: 'uglydex_session', value: token, url: base },
    ]);
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await stubArtwork(page);
    await mkdir('.data/design', { recursive: true });
    const artworkReady = async () => {
      await page.evaluate(() => document.fonts.ready);
      await page.waitForFunction(() =>
        Array.from(document.querySelectorAll<HTMLImageElement>('.artwork img'))
          .filter((img) => {
            const r = img.getBoundingClientRect();
            return (
              r.bottom > 0 &&
              r.top < innerHeight &&
              r.right > 0 &&
              r.left < innerWidth
            );
          })
          .every((img) => img.complete && img.naturalWidth > 0),
      );
    };
    await page.goto(base + '/collection');
    await expect(
      page.locator('#collection-cards .collection-grid.grid'),
    ).toBeVisible();
    await page.getByRole('button', { name: '▥ Album', exact: true }).click();
    await expect(page).toHaveURL(/view=album/);
    // A new visit without a view parameter restores the user's selection.
    await page.goto(base + '/collection');
    await expect(
      page.locator('.collection-grid.album .album-card'),
    ).toHaveCount(6);
    await expect(page.locator('[data-open-card]').first()).toHaveAttribute(
      'data-open-card',
      '1300',
    );
    await page.locator('.view-controls').scrollIntoViewIfNeeded();
    await artworkReady();
    await page.screenshot({ path: '.data/design/album-desktop.png' });
    await page.locator('[data-open-card]').first().click();
    const viewer = page.getByRole('dialog');
    await expect(viewer).toBeVisible();
    await expect(viewer.getByRole('heading')).toHaveText('Squig #1300');
    await expect(
      viewer.getByRole('button', { name: 'Previous card', exact: false }),
    ).toBeDisabled();
    for (let n = 0; n < 6; n++)
      await viewer
        .getByRole('button', { name: 'Next card', exact: false })
        .click();
    await expect(page).toHaveURL(/page=2/);
    await expect(viewer).toBeVisible();
    await expect(viewer.getByRole('heading')).toHaveText('Squig #1006');
    await expect(viewer).toContainText('7 of 300 matching Squigs');
    await viewer
      .getByRole('button', { name: 'Previous card', exact: false })
      .click();
    await expect(page).not.toHaveURL(/page=2/);
    await expect(viewer.getByRole('heading')).toHaveText('Squig #1005');
    await viewer.getByRole('button', { name: 'Close', exact: false }).click();
    await expect(viewer).toHaveCount(0);
    await expect(page.locator('[data-open-card="1005"]')).toBeFocused();
    for (const width of [360, 390, 430, 768]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(base + '/collection?view=album&sort=token');
      await page.locator('.view-controls').scrollIntoViewIfNeeded();
      await artworkReady();
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `album fits ${width}`,
      );
      await page.screenshot({ path: `.data/design/album-${width}.png` });
      await page.locator('[data-open-card]').first().click();
      await expect(viewer).toBeVisible();
      const card = viewer.locator('.album-viewer-card');
      await card.dispatchEvent('pointerdown', {
        pointerType: 'touch',
        clientX: 260,
        clientY: 250,
      });
      await card.dispatchEvent('pointerup', {
        pointerType: 'touch',
        clientX: 100,
        clientY: 255,
      });
      await expect(viewer.getByRole('heading')).toHaveText('Squig #1002');
      await page.screenshot({ path: `.data/design/viewer-${width}.png` });
      await page.keyboard.press('Escape');
      await expect(viewer).toHaveCount(0);
    }
    await page.goto(base + '/collection?q=%231300');
    await expect(
      page.locator('.collection-grid.album.single-card'),
    ).toBeVisible();
    await expect(page.locator('[data-open-card]')).toHaveCount(1);
    await page.getByRole('button', { name: '▤ Compact', exact: true }).click();
    await expect(page.locator('.collection-grid.compact')).toBeVisible();
    await expect(page).toHaveURL(/q=%231300/);
    await page.goto(base + '/collection?q=bad-search&view=album');
    await expect(page.locator('main').getByRole('alert')).toContainText(
      'doesn’t look like',
    );
    await expect(page.locator('[data-open-card]')).toHaveCount(0);
    await page
      .getByRole('link', {
        name: 'Remove Search: bad-search filter',
        exact: true,
      })
      .click();
    await expect(page.locator('[data-open-card]')).toHaveCount(6);
    await expect(
      page.getByRole('textbox', { name: 'Token ID', exact: true }),
    ).toHaveValue('');
    await page
      .getByRole('textbox', { name: 'Token ID', exact: true })
      .fill(`https://opensea.io/assets/ethereum/${SQUIGS_CONTRACT}/1300`);
    await page
      .getByRole('button', { name: 'Apply filters', exact: true })
      .click();
    await expect(page.locator('[data-open-card]')).toHaveCount(1);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.locator('[data-open-card]').click();
    await expect(
      viewer.getByRole('button', { name: 'Card motion off', exact: true }),
    ).toBeVisible();
    await page.keyboard.press('Escape');
    check(
      errors.length === 0,
      `album browser has no runtime errors: ${errors.join('; ')}`,
    );
  } finally {
    await browser.close();
  }
}
