import type { Page } from '@playwright/test';
import sharp from 'sharp';

// Register after generic API handlers so browser checks never fetch remote Squigs.
export async function stubArtwork(page: Page) {
  const body = await sharp({
    create: { width: 32, height: 32, channels: 3, background: '#875f92' },
  })
    .png()
    .toBuffer();
  await page.route(
    (url) =>
      url.pathname === '/_next/image' ||
      url.pathname.startsWith('/api/artwork/squigs/'),
    (route) => route.fulfill({ status: 200, contentType: 'image/png', body }),
  );
}
