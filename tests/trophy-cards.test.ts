import { expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';
import {
  achievementTrophy,
  achievementTiers,
  setTrophy,
} from '../src/domain/trophy-card';
import { shareSchema } from '../src/domain/sharing';
import { TrophyCardFace } from '../src/components/trophy-card-face';
import { renderTrophyCard } from '../src/server/trophy-card-render';
const identity = { collector: 'GuyLeDouce', avatarTokenId: null };
const earned = {
  key: 'collector-wins-25',
  name: 'Certified Menace',
  description: 'Win 25 confirmed Squig Duels.',
  tier: 'Epic',
  unlocked: true,
  badge: {
    key: 'collector-wins-25',
    name: 'Certified Menace',
    url: '/achievements/collector/certified-menace.png',
    subject: 'COLLECTOR' as const,
    status: 'earned' as const,
  },
};
it('accepts only single collector achievement or set trophy requests', () => {
  for (const kind of ['achievement', 'set'])
    expect(
      shareSchema.safeParse({
        kind,
        entity: 'guyledouce',
        key: 'collector-wins-25',
        format: 'trophy-card',
      }).success,
    ).toBe(true);
  for (const spec of [
    { kind: 'squig', entity: '1', key: 'squig-duels-1' },
    { kind: 'collector', entity: 'guyledouce' },
    { kind: 'achievement', entity: 'guyledouce' },
    {
      kind: 'achievement',
      entity: 'guyledouce',
      key: 'a',
      achievements: 'a,b',
    },
  ])
    expect(
      shareSchema.safeParse({ ...spec, format: 'trophy-card' }).success,
    ).toBe(false);
});
it('never turns locked, pending, hidden or Squig awards into collector cards', () => {
  expect(
    achievementTrophy({ ...earned, unlocked: false }, identity),
  ).toBeNull();
  expect(
    achievementTrophy({ ...earned, badge: { status: 'hidden' } }, identity),
  ).toBeNull();
  expect(
    achievementTrophy(
      { ...earned, badge: { ...earned.badge, status: 'pending' } },
      identity,
    ),
  ).toBeNull();
  expect(
    achievementTrophy(
      { ...earned, badge: { ...earned.badge, subject: 'SQUIG' } },
      identity,
    ),
  ).toBeNull();
});
it('preserves set difficulty and completion mode without inventing rarity', () => {
  const set = {
    key: 'og-curious',
    name: 'OG Curious',
    description: 'Discover an OG Squig.',
    difficulty: 'Easy',
    complete: true,
    revealed: true,
    mode: 'HISTORICAL_DISCOVERY',
  };
  const card = setTrophy(set, identity)!;
  expect(card.classification).toBe('Easy');
  expect(card.rarity).toBe('unclassified');
  expect(card.status).toBe('HISTORICAL SET COMPLETE');
  expect(setTrophy({ ...set, complete: false }, identity)).toBeNull();
  expect(setTrophy({ ...set, revealed: false }, identity)).toBeNull();
  expect(setTrophy({ ...set, mode: 'CURRENT_HOLDING' }, identity)?.status).toBe(
    'CURRENT HOLDING COMPLETE',
  );
});
it('renders every existing rarity to a real, full-resolution PNG with no earned date', async () => {
  mkdirSync('.data/design', { recursive: true });
  for (const tier of achievementTiers) {
    const card = achievementTrophy({ ...earned, tier }, identity)!;
    expect(card.rarity).toBe(tier.toLowerCase());
    const html = renderToStaticMarkup(createElement(TrophyCardFace, { card }));
    expect(html).toContain('Certified Menace');
    expect(html).toContain('GuyLeDouce');
    expect(html).not.toMatch(/Qualified|Earned on|Completed on|2026/);
    const png = Buffer.from(await renderTrophyCard(card).arrayBuffer());
    const metadata = await sharp(png).metadata();
    expect(metadata.width).toBe(1500);
    expect(metadata.height).toBe(2100);
    expect(png.length).toBeGreaterThan(100000);
    writeFileSync(`.data/design/trophy-${tier.toLowerCase()}.png`, png);
  }
}, 60000);
