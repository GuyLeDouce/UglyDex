import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { shareBackground } from '../src/server/share-backgrounds';
import { renderShare } from '../src/server/share-render';
import {
  resolveShareStyle,
  shareStyleLabels,
  type ShareStyle,
} from '../src/domain/share-styles';
import { resolveAppearance } from '../src/domain/cosmetics';
import type { ShareCard } from '../src/domain/sharing';

const mocks = vi.hoisted(() => ({
  currentSession: vi.fn(),
  shareCard: vi.fn(),
  shareLimit: vi.fn(),
  sharePng: vi.fn(),
}));
vi.mock('@/server/auth', () => ({ currentSession: mocks.currentSession }));
vi.mock('@/server/sharing', () => ({ shareCard: mocks.shareCard }));
vi.mock('@/server/share-cache', () => ({
  shareLimit: mocks.shareLimit,
  sharePng: mocks.sharePng,
}));
import { GET } from '../src/app/api/share/route';

const card: ShareCard = {
  title: 'Squig #1',
  eyebrow: 'SQUIGS RELOADED',
  description: 'Every Squig has a story.',
  stats: ['Level 1'],
  badges: [],
  tokens: [],
  path: '/squig/1',
  indexable: true,
  appearance: { accent: 'moss', share: 'ugly' },
};
const originals = [
  [
    'clean',
    '5074d46e979fd5ba443df1cb973da65cf3926cf3f7d8db21c1b4735203a7ecfc',
    1731,
  ],
  [
    'ugly',
    'e44ca51c12914b824c7615eb773c8fef7439f0eb28eae0d9c7c32e25608ecbf0',
    1730,
  ],
  [
    'stats',
    '2b02a08698cc9291d627d5c7a7516d9b46bc4f85127acaf7edc73ad51f4ff00c',
    1731,
  ],
] as const;

const allStyles = Object.keys(shareStyleLabels) as ShareStyle[];

describe('supplied sharing backgrounds', () => {
  it.each(originals)(
    '%s embeds the original supplied PNG without a remote fetch',
    async (style, digest, width) => {
      const bytes = Buffer.from(shareBackground(style).split(',')[1], 'base64');
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(digest);
      expect(await sharp(bytes).metadata()).toMatchObject({
        format: 'png',
        width,
        height: 909,
      });
    },
  );
  it('keeps saved Stats preferences compatible while displaying Intergalactic', () => {
    expect(shareStyleLabels.stats).toBe('Intergalactic');
    expect(
      resolveAppearance(
        [{ kind: 'SHARE_STYLE', cosmeticId: 'share-stats' }],
        ['share-stats'],
      ).share,
    ).toBe('stats');
    expect(resolveShareStyle(undefined, 'stats')).toBe('stats');
    expect(resolveShareStyle('clean', 'ugly')).toBe('clean');
  });
  it.each(['landscape', 'square'] as const)(
    'renders all distinct backgrounds in %s exports',
    async (ratio) => {
      const samples = [];
      for (const template of allStyles) {
        const png = Buffer.from(
          await renderShare(card, { ratio, template }, {}).arrayBuffer(),
        );
        expect(await sharp(png).metadata()).toMatchObject({
          width: ratio === 'square' ? 1080 : 1200,
          height: ratio === 'square' ? 1080 : 630,
        });
        // Sample the exposed background outside the text panels, not text/layout differences.
        const strip = await sharp(png)
          .extract({ left: 2, top: 100, width: 16, height: 400 })
          .raw()
          .toBuffer();
        samples.push(createHash('sha256').update(strip).digest('hex'));
      }
      expect(new Set(samples).size).toBe(allStyles.length);
    },
    30000,
  );
});

describe('share download style selection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.currentSession.mockResolvedValue(null);
    mocks.shareCard.mockResolvedValue(card);
    mocks.shareLimit.mockResolvedValue(undefined);
    mocks.sharePng.mockResolvedValue(new Uint8Array([137, 80, 78, 71]));
  });
  it.each(allStyles)(
    'honors an explicit %s selection over a saved preference',
    async (template) => {
      const response = await GET(
        new Request(
          `https://uglydex.test/api/share?kind=squig&entity=1&template=${template}&download=1`,
        ),
      );
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Disposition')).toContain(
        'attachment',
      );
      expect(mocks.sharePng).toHaveBeenCalledWith(
        card,
        expect.objectContaining({ template }),
      );
    },
  );
  it('uses the saved style when no explicit choice is supplied', async () => {
    await GET(
      new Request('https://uglydex.test/api/share?kind=squig&entity=1'),
    );
    expect(mocks.sharePng).toHaveBeenCalledWith(
      card,
      expect.objectContaining({ template: 'ugly' }),
    );
  });
  it('still rejects a private card before rendering', async () => {
    mocks.shareCard.mockResolvedValue(null);
    expect(
      (
        await GET(
          new Request(
            'https://uglydex.test/api/share?kind=collector&entity=hidden&template=ugly',
          ),
        )
      ).status,
    ).toBe(404);
    expect(mocks.sharePng).not.toHaveBeenCalled();
  });
});
