import { db } from '../../src/server/db';
import { SQUIGS_CONTRACT } from '../../src/domain/validation';
import catalog from '../../data/squigs.json';
import { squigArtwork } from '../../src/domain/assets';
import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';

export async function interactiveCardTests(
  base: string,
  check: (v: unknown, m: string) => void,
) {
  const { chromium, webkit } = await import('@playwright/test');
  await mkdir('.data/interactive-cards', { recursive: true });
  const records = ['common', 'uncommon', 'rare', 'epic', 'legendary'].map(
    (rarity) =>
      catalog.records.find((r) => r.rarityTier === rarity && !r.og) ??
      catalog.records.find((r) => r.rarityTier === rarity)!,
  );
  records.push(catalog.records.find((r) => r.legendary && r.og)!);
  for (const record of records) {
    const data = {
      name: record.name,
      imageUrl: squigArtwork(record.tokenId),
      uglyPoints: record.uglyPoints,
      mawRank: record.mawRank,
      rarityTier: record.rarityTier,
      og: record.og,
      legendary: record.legendary,
    };
    const s = await db().squig.upsert({
      where: {
        chainId_contractAddress_tokenId: {
          chainId: 1,
          contractAddress: SQUIGS_CONTRACT,
          tokenId: record.tokenId,
        },
      },
      create: {
        chainId: 1,
        contractAddress: SQUIGS_CONTRACT,
        tokenId: record.tokenId,
        ...data,
      },
      update: data,
    });
    for (const [traitType, value] of Object.entries(record.traits))
      await db().squigTrait.upsert({
        where: { squigId_traitType: { squigId: s.id, traitType } },
        create: { squigId: s.id, traitType, value },
        update: { value },
      });
  }
  const evidence: unknown[] = [];
  for (const [engine, type] of [
    ['chromium', chromium],
    ['webkit', webkit],
  ] as const) {
    const browser = await type.launch({ headless: true });
    try {
      const page = await browser.newPage({
        viewport: { width: 1440, height: 1000 },
        reducedMotion: 'reduce',
        hasTouch: true,
      });
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      for (const record of engine === 'chromium' ? records : [records[2]]) {
        const name = `${engine}-${record.rarityTier}${record.og ? '-og' : ''}`;
        const pngResponse = page.waitForResponse(
          (response) =>
            response.url().includes('/api/share?') && response.status() === 200,
        );
        await page.goto(
          `${base}/share?kind=passport&entity=${record.tokenId}&format=trading-card`,
        );
        await page
          .locator('.share-preview')
          .waitFor({ state: 'visible', timeout: 60000 });
        await page.waitForFunction(() => {
          const img =
            document.querySelector<HTMLImageElement>('.share-preview');
          return img?.complete && img.naturalWidth === 1500;
        });
        await page
          .getByRole('button', { name: 'View Interactive Card', exact: true })
          .click();
        const viewer = page.getByRole('dialog');
        await viewer.waitFor();
        await viewer
          .getByRole('button', { name: 'Download finished PNG', exact: true })
          .waitFor();
        await page.waitForFunction(
          () =>
            !document.querySelector<HTMLButtonElement>(
              'dialog .card-viewer-tools > button',
            )?.disabled,
        );
        check(
          await viewer.getByRole('button', { name: 'Motion off' }).isVisible(),
          'reduced-motion starts static',
        );
        await viewer.screenshot({
          path: `.data/interactive-cards/${name}-desktop.png`,
        });
        const pngDownload = page.waitForEvent('download');
        await viewer
          .getByRole('button', { name: 'Download finished PNG' })
          .click();
        const png = await pngDownload;
        const pngPath = `.data/interactive-cards/${name}.png`;
        await png.saveAs(pngPath);
        const original = await (await pngResponse).body();
        await writeFile(`.data/interactive-cards/${name}-base.png`, original);
        for (const region of [
          { left: 170, top: 305, width: 1160, height: 1160 },
          { left: 120, top: 1720, width: 1260, height: 245 },
        ]) {
          const before = await sharp(original)
            .extract(region)
            .ensureAlpha()
            .raw()
            .toBuffer();
          const after = await sharp(pngPath)
            .extract(region)
            .ensureAlpha()
            .raw()
            .toBuffer();
          check(
            before.equals(after),
            'finished PNG preserves original artwork and trait pixels exactly',
          );
        }
        const metadata = await sharp(pngPath).metadata();
        check(
          metadata.width === 1500 && metadata.height === 2100,
          'finished PNG stays 5:7 high resolution',
        );
        await viewer
          .getByRole('button', { name: 'Download Animated Card' })
          .click();
        try {
          await viewer
            .locator('video')
            .waitFor({ state: 'visible', timeout: 35000 });
        } catch {
          await viewer.screenshot({
            path: `.data/interactive-cards/${name}-export-error.png`,
          });
          throw new Error(
            `Export failed in ${name}: ${await viewer.innerText()}`,
          );
        }
        const save = viewer.getByRole('button', { name: /^Save (MP4|WebM)$/ });
        const label = await save.textContent();
        const videoDownload = page.waitForEvent('download');
        await save.click();
        const movie = await videoDownload;
        const path = `.data/interactive-cards/${name}.${label?.includes('MP4') ? 'mp4' : 'webm'}`;
        await movie.saveAs(path);
        const probe = JSON.parse(
          execFileSync(
            'ffprobe',
            [
              '-v',
              'quiet',
              '-count_frames',
              '-show_streams',
              '-show_format',
              '-of',
              'json',
              path,
            ],
            { encoding: 'utf8' },
          ),
        );
        const stream = probe.streams.find(
          (s: { codec_type: string }) => s.codec_type === 'video',
        );
        check(
          stream.width === 900 && stream.height === 1260,
          'real animated file has expected dimensions',
        );
        check(
          Number(stream.nb_read_frames) >= 90,
          'animated download has at least 15 decoded frames per second',
        );
        const frames = execFileSync(
          'ffmpeg',
          ['-v', 'error', '-i', path, '-vf', 'fps=2', '-f', 'framemd5', '-'],
          { encoding: 'utf8' },
        )
          .split('\n')
          .filter((line) => line && !line.startsWith('#'));
        check(
          frames.length >= 10 &&
            new Set(frames.map((f) => f.split(',').at(-1))).size >= 10,
          'download contains distinct decoded motion frames',
        );
        execFileSync('ffmpeg', [
          '-y',
          '-v',
          'error',
          '-ss',
          '1.5',
          '-i',
          path,
          '-frames:v',
          '1',
          `.data/interactive-cards/${name}-frame.png`,
        ]);
        evidence.push({
          engine,
          browserVersion: browser.version(),
          tokenId: record.tokenId,
          rarity: record.rarityTier,
          og: record.og,
          format: probe.format,
          codec: stream.codec_name,
          frameRate: stream.avg_frame_rate,
          frameCount: stream.nb_read_frames,
          decodedFrames: frames.length,
        });
        if (record === records[2])
          for (const width of [360, 390, 430, 768]) {
            await page.setViewportSize({ width, height: 900 });
            check(
              await viewer.evaluate(
                (element) => element.scrollWidth <= innerWidth + 1,
              ),
              'viewer fits mobile width',
            );
            await viewer.screenshot({
              path: `.data/interactive-cards/${engine}-${width}.png`,
            });
            if (engine === 'chromium' && width === 390) {
              await viewer.getByRole('button', { name: 'Motion off' }).click();
              const box = await viewer.locator('canvas').boundingBox();
              if (!box) throw new Error('Missing touch card');
              const cdp = await page.context().newCDPSession(page);
              await cdp.send('Input.dispatchTouchEvent', {
                type: 'touchStart',
                touchPoints: [
                  { x: box.x + box.width / 2, y: box.y + box.height / 2 },
                ],
              });
              const before = await viewer
                .locator('canvas')
                .evaluate((c: HTMLCanvasElement) => c.toDataURL());
              await cdp.send('Input.dispatchTouchEvent', {
                type: 'touchMove',
                touchPoints: [
                  { x: box.x + box.width * 0.8, y: box.y + box.height * 0.3 },
                ],
              });
              await page.waitForFunction(
                (previous) =>
                  document
                    .querySelector<HTMLCanvasElement>('dialog canvas')
                    ?.toDataURL() !== previous,
                before,
              );
              await cdp.send('Input.dispatchTouchEvent', {
                type: 'touchEnd',
                touchPoints: [],
              });
              await cdp.detach();
              await viewer.getByRole('button', { name: 'Reset angle' }).click();
              check(
                await viewer
                  .getByRole('button', { name: 'Motion off' })
                  .isVisible(),
                'touch tilt and reset work in mobile Chromium',
              );
            }
          }
        await page.setViewportSize({ width: 1440, height: 1000 });
        await viewer.getByRole('button', { name: 'Motion off' }).click();
        const card = viewer.locator('canvas');
        await card.focus();
        await card.press('ArrowRight');
        await viewer.getByRole('button', { name: 'Reset angle' }).click();
        check(
          await viewer.getByRole('button', { name: 'Motion off' }).isVisible(),
          'reset stops motion',
        );
        await page.keyboard.press('Escape');
        check(!(await viewer.isVisible()), 'Escape closes viewer');
      }
      check(
        errors.length === 0,
        `${engine} card flows have no runtime errors: ${errors.join(',')}`,
      );
    } finally {
      await browser.close();
    }
  }
  await writeFile(
    '.data/interactive-cards/evidence.json',
    JSON.stringify(evidence, null, 2),
  );
}
