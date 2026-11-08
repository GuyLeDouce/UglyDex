import { expect, it } from 'vitest';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
import { shareSchema, type ShareCard } from '../src/domain/sharing';
import { shareFilename } from '../src/domain/trading-card';
import { renderShareSafe } from '../src/server/share-render';
const spec = shareSchema.parse({
  kind: 'collector',
  entity: 'fixture',
  format: 'collector-card',
});
const card: ShareCard = {
  title: 'GuyLeDouce',
  eyebrow: 'UGLYDEX COLLECTOR',
  description: 'Fixture',
  stats: [],
  badges: [],
  tokens: [],
  path: '/collector/fixture',
  indexable: true,
  collectorCard: {
    avatar: null,
    avatarTokenId: null,
    completion: 54,
    discovered: 309,
    traits: 298,
    historicalSets: 31,
    achievements: 36,
    level: 21,
  },
};
it('accepts collector format only for collector profiles and names downloads distinctly', () => {
  for (const kind of ['passport', 'squig', 'collage', 'trophy'])
    expect(shareSchema.safeParse({ ...spec, kind }).success).toBe(false);
  expect(shareFilename(spec)).toBe('uglydex-fixture-collector-card.png');
});
it('renders full size cards, long names and unscored profiles without fabricating values', async () => {
  mkdirSync('.data/interactive-cards', { recursive: true });
  for (const [name, c] of Object.entries({
    standard: card,
    long: { ...card, title: 'A Very Long Collector Display Name Here' },
    pending: {
      ...card,
      collectorCard: {
        avatar: null,
        avatarTokenId: null,
        completion: null,
        discovered: null,
        traits: null,
        historicalSets: null,
        achievements: null,
        level: null,
      },
    },
  })) {
    const art: Record<number, string | null> = process.env.COLLECTOR_SAMPLE_ART
      ? {
          0:
            'data:image/png;base64,' +
            readFileSync(process.env.COLLECTOR_SAMPLE_ART).toString('base64'),
        }
      : {};
    const result = await renderShareSafe(c, spec, art);
    expect(result.fallback).toBe(false);
    expect(await sharp(result.bytes).metadata()).toMatchObject({
      width: 1500,
      height: 2100,
      format: 'png',
    });
    writeFileSync(
      `.data/interactive-cards/collector-${name}.png`,
      result.bytes,
    );
  }
});
it('fails rather than exporting a misleading missing-avatar card', async () => {
  await expect(
    renderShareSafe(
      {
        ...card,
        collectorCard: {
          ...card.collectorCard!,
          avatar: 'https://squigs.io/images/images/1497.png',
          avatarTokenId: 1497,
        },
      },
      spec,
      {},
    ),
  ).rejects.toThrow('TRADING_CARD_ARTWORK_UNAVAILABLE');
});
