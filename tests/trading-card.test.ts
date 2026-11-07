import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import snapshot from '../data/squigs.json';
import { tradingCardData, shareFilename } from '../src/domain/trading-card';
import { shareSchema, type ShareCard } from '../src/domain/sharing';
import { renderShareSafe } from '../src/server/share-render';
import {
  renderTradingCard,
  tradingCardElement,
} from '../src/server/trading-card-render';

function data(record = snapshot.records[0]) {
  return tradingCardData({
    ...record,
    traits: Object.entries(record.traits).map(([traitType, value]) => ({
      traitType,
      value,
    })),
    metadataSourceHash: 'fixture-revision',
    metadataUpdatedAt: new Date('2026-11-01T00:00:00Z'),
  });
}
describe('trading-card metadata and boundaries', () => {
  it('allows only valid public Squig/passport trading-card requests', () => {
    for (const kind of ['squig', 'passport'])
      expect(
        shareSchema.safeParse({ kind, entity: '312', format: 'trading-card' })
          .success,
      ).toBe(true);
    for (const entity of ['owner', '0', '4445', '01', '-1', '1.5'])
      expect(
        shareSchema.safeParse({
          kind: 'passport',
          entity,
          format: 'trading-card',
        }).success,
      ).toBe(false);
    for (const kind of [
      'collector',
      'custom',
      'gallery',
      'achievement',
      'collage',
    ])
      expect(
        shareSchema.safeParse({ kind, entity: '312', format: 'trading-card' })
          .success,
      ).toBe(false);
    expect(
      shareSchema.parse({ kind: 'passport', entity: '312' }).format,
    ).toBeUndefined();
  });
  it('projects every canonical record without fabricating or losing meaningful front traits', () => {
    for (const record of snapshot.records) {
      const projected = data(record);
      expect(projected.uglyPoints).toBe(String(record.uglyPoints));
      expect(projected.mawRank).toBe(record.mawRank);
      expect(projected.og).toBe(record.og);
      expect(projected.rarity).toBe(record.rarityTier);
      expect(projected.traits.length).toBeLessThanOrEqual(7);
      const meaningful = Object.entries(record.traits).filter(
        ([key, value]) =>
          !['Type', 'Status', 'Legend'].includes(key) &&
          value.trim() &&
          value.toLowerCase() !== 'none',
      );
      expect(projected.traits).toHaveLength(meaningful.length);
      for (const trait of projected.traits)
        expect(
          record.traits[trait.traitType as keyof typeof record.traits].trim(),
        ).toBe(trait.value);
    }
  });
  it('preserves Legendary names, 1200-point OG values and shared rank', () => {
    const legend = snapshot.records.find((r) => r.legendary && r.og)!;
    const card = data(legend);
    expect(card.uglyPoints).toBe('1200');
    expect(card.mawRank).toBe(1);
    expect(card.legend).toBe(legend.traits.Legend);
    expect(card.traits).toEqual([]);
    const html = renderToStaticMarkup(
      tradingCardElement(card, 'data:image/png;base64,fixture'),
    );
    expect(html).toContain('SHARED');
    expect(html).toContain(legend.traits.Legend);
    expect(html).not.toContain('Traits not indexed');
  });
  it('keeps unknown metadata explicit and escapes trait text', () => {
    const card = tradingCardData({
      tokenId: 1,
      rarityTier: null,
      legendary: null,
      og: null,
      uglyPoints: null,
      mawRank: null,
      metadataSourceHash: null,
      metadataUpdatedAt: null,
      traits: [{ traitType: 'Head', value: '<script>bad</script>' }],
    });
    expect(card).toMatchObject({
      rarity: 'unclassified',
      og: false,
      legendary: false,
      uglyPoints: null,
      mawRank: null,
    });
    expect(
      renderToStaticMarkup(
        tradingCardElement(card, 'data:image/png;base64,fixture'),
      ),
    ).toContain('&lt;script&gt;');
    expect(shareFilename({ entity: '312', format: 'trading-card' })).toBe(
      'squigs-reloaded-312-trading-card.png',
    );
  });
});

describe('trading-card export', () => {
  it('renders each rarity at 1500 × 2100 with distinct frames and intact square artwork', async () => {
    const fixture = await sharp({
      create: { width: 1180, height: 1180, channels: 3, background: '#eb3588' },
    })
      .png()
      .toBuffer();
    const samples = [];
    for (const rarity of ['common', 'uncommon', 'rare', 'epic', 'legendary']) {
      const record =
        rarity === 'epic'
          ? snapshot.records.find((r) => r.tokenId === 312)!
          : snapshot.records.find((r) => r.rarityTier === rarity)!;
      const card = data(record);
      const realPath = `.data/trading-art-${record.tokenId}.png`;
      const art =
        process.env.TRADING_CARD_REVIEW && existsSync(realPath)
          ? readFileSync(realPath)
          : fixture;
      const image = `data:image/png;base64,${art.toString('base64')}`;
      const bytes = Buffer.from(
        await renderTradingCard(card, image).arrayBuffer(),
      );
      expect(await sharp(bytes).metadata()).toMatchObject({
        format: 'png',
        width: 1500,
        height: 2100,
      });
      const frame = await sharp(bytes)
        .extract({ left: 15, top: 300, width: 20, height: 200 })
        .raw()
        .toBuffer();
      samples.push(createHash('sha256').update(frame).digest('hex'));
      if (art === fixture) {
        // Four distant corners of the square remain original art, not a crop/overlay.
        for (const [left, top] of [
          [166, 301],
          [1324, 301],
          [166, 1459],
          [1324, 1459],
        ]) {
          const pixel = await sharp(bytes)
            .extract({ left, top, width: 1, height: 1 })
            .removeAlpha()
            .raw()
            .toBuffer();
          expect([...pixel]).toEqual([235, 53, 136]);
        }
      }
      if (process.env.TRADING_CARD_REVIEW)
        writeFileSync(`.data/trading-${rarity}.png`, bytes);
    }
    expect(new Set(samples).size).toBe(5);
  }, 30000);
  it('rejects missing/corrupt artwork instead of exporting a placeholder', async () => {
    const card: ShareCard = {
      title: 'Squig #1',
      eyebrow: '',
      description: '',
      stats: [],
      badges: [],
      tokens: [1],
      path: '/squig/1',
      indexable: true,
      tradingCard: data(),
    };
    const spec = { ratio: 'landscape', template: 'clean' } as const;
    await expect(renderShareSafe(card, spec, {})).rejects.toThrow(
      'TRADING_CARD_ARTWORK_UNAVAILABLE',
    );
    await expect(
      renderShareSafe(card, spec, { 1: 'data:image/png;base64,YmFk' }),
    ).rejects.toThrow();
  });
});
