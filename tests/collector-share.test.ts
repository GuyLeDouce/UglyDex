import { expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import sharp from 'sharp';
import { renderShare } from '../src/server/share-render';
import { publicAvatarAddress } from '../src/server/share-avatar';
import { shareSchema, type ShareCard } from '../src/domain/sharing';
it('rejects private network avatar destinations', () => {
  for (const ip of [
    '127.0.0.1',
    '10.0.0.1',
    '169.254.169.254',
    '192.168.1.1',
    '172.16.0.1',
    '100.64.0.1',
    '::1',
  ])
    expect(publicAvatarAddress(ip)).toBe(false);
  expect(publicAvatarAddress('8.8.8.8')).toBe(true);
});
it('limits set selection and supports explicitly empty selections', () => {
  expect(
    shareSchema.safeParse({
      kind: 'collector',
      entity: 'ugly-friend',
      sets: 'a,b,c,d,e,f,g,h,i,j',
    }).success,
  ).toBe(false);
  expect(
    shareSchema.safeParse({
      kind: 'collector',
      entity: 'ugly-friend',
      sets: 'a,b,c,d,e,f,g,h,i',
    }).success,
  ).toBe(true);
  expect(
    shareSchema.safeParse({
      kind: 'collector',
      entity: 'ugly-friend',
      sets: '',
      achievements: '',
    }).success,
  ).toBe(true);
});
it('renders the combined card in both shapes with all slots occupied', async () => {
  const card: ShareCard = {
    title: 'Guy LeDouce',
    eyebrow: 'COLLECTOR',
    description: '',
    stats: [],
    badges: [],
    tokens: [1, 2, 3, 4, 5, 6],
    path: '/collector/guy',
    indexable: true,
    achievementBadges: Array.from({ length: 8 }, (_, i) => ({
      key: [
        'collector-discoveries-1',
        'collector-discoveries-5',
        'collector-discoveries-10',
        'collector-discoveries-20',
        'collector-discoveries-25',
        'collector-discoveries-50',
      ][i % 6],
      name: [
        'First Ugly',
        'Getting Ugly',
        'Certified Hoarder',
        'Deep in the Dex',
        'Field Researcher',
        'Ugly Archivist',
      ][i % 6],
      subject: 'COLLECTOR',
      url: '',
      status: 'earned',
    })),
    collectorLayout: {
      avatar: null,
      level: 18,
      completion: 43.2,
      squigs: 24,
      discovered: 137,
      sets: Array.from({ length: 9 }, (_, i) => ({
        key: String(i),
        name: [
          'First Specimen',
          'Field Notes',
          'Strange Company',
          'Deep Archive',
          'Living Library',
          'Purple People Eater',
        ][i % 6],
        icon: '/icons/sets/first-specimen.png',
      })),
    },
  };
  for (const ratio of ['landscape', 'square'] as const) {
    const bytes = Buffer.from(
      await renderShare(card, { ratio, template: 'clean' }, {}).arrayBuffer(),
    );
    expect(await sharp(bytes).metadata()).toMatchObject({
      width: ratio === 'square' ? 1080 : 1200,
      height: ratio === 'square' ? 1080 : 630,
    });
    if (process.env.COLLECTOR_RENDER_REVIEW)
      writeFileSync(`/tmp/collector-${ratio}.png`, bytes);
  }
});
