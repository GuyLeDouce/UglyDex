import snapshot from '../../data/squigs.json';
import {
  buildTraitCatalog,
  type DexToken,
  type Requirement,
  type SetDefinition,
} from './dex';
export const canonicalTokens: DexToken[] = snapshot.records;
export const traitCatalog = buildTraitCatalog(canonicalTokens);
const count = (n: number, filter?: Requirement['filter']): Requirement => ({
  kind: 'COUNT',
  count: n,
  filter,
});
const trait = (type: string, value: string, n = 1) =>
  count(n, { traits: [{ type, values: [value] }] });
const unique = (
  type: string,
  n: number,
  filter?: Requirement['filter'],
): Requirement => ({
  kind: 'UNIQUE_TRAIT_VALUES',
  traitType: type,
  count: n,
  filter,
});
const all = (type: string, values: string[]) =>
  values.map((v) => trait(type, v));
const historical = (
  key: string,
  name: string,
  category: string,
  requirements: Requirement[],
  difficulty: SetDefinition['difficulty'] = 'Medium',
  hidden = false,
): SetDefinition => ({
  key,
  name,
  category,
  requirements,
  difficulty,
  hidden,
  mode: 'HISTORICAL_DISCOVERY',
  description:
    'Discover ' + requirements.map(requirementLabel).join(' and ') + '.',
});
const current = (
  key: string,
  name: string,
  category: string,
  requirements: Requirement[],
  difficulty: SetDefinition['difficulty'] = 'Medium',
  hidden = false,
): SetDefinition => ({
  ...historical(key, name, category, requirements, difficulty, hidden),
  mode: 'CURRENT_HOLDING',
  description:
    'Currently hold ' +
    requirements.map(requirementLabel).join(' and ') +
    ', simultaneously.',
});
export function requirementLabel(r: Requirement): string {
  const f = r.filter;
  return r.kind === 'TOKEN_IDS'
    ? `Squigs ${r.tokenIds!.map((n) => '#' + n).join(', ')}`
    : `${r.count} ${r.kind === 'UNIQUE_TRAIT_VALUES' ? `different ${r.traitType} values` : `${f?.og ? 'OG ' : ''}${f?.legendary ? 'Legendary ' : ''}${f?.rarity ? f.rarity + ' ' : ''}Squig${r.count === 1 ? '' : 's'}`}${f?.traits?.map((t) => ` with ${t.type}: ${t.values.join(' or ')}`).join('') ?? ''}`;
}
export const collectionSets: SetDefinition[] = [
  historical('first-specimen', 'First Specimen', 'Starter', [count(1)], 'Easy'),
  historical('field-notes', 'Field Notes', 'Starter', [count(5)], 'Easy'),
  historical('strange-company', 'Strange Company', 'Starter', [count(10)]),
  historical('deep-archive', 'Deep Archive', 'Mastery', [count(100)], 'Hard'),
  historical(
    'living-library',
    'Living Library',
    'Mastery',
    [count(500)],
    'Insane',
  ),
  historical(
    'og-curious',
    'OG Curious',
    'OG',
    [count(1, { og: true })],
    'Easy',
  ),
  historical('og-problem', 'OG Problem', 'OG', [count(5, { og: true })]),
  historical(
    'original-archive',
    'Original Archive',
    'OG',
    [count(25, { og: true })],
    'Hard',
  ),
  historical(
    'legendary-encounter',
    'Legendary Encounter',
    'Legendary',
    [count(1, { legendary: true })],
    'Hard',
  ),
  historical(
    'legend-lore',
    'Legend Lore',
    'Legendary',
    [count(3, { legendary: true })],
    'Insane',
  ),
  historical('purple-people', 'Purple People Eater', 'Traits', [
    trait('Skin', 'Purple', 5),
  ]),
  historical('elf-research', 'Elf Research', 'Traits', [
    unique('Skin', 4, { traits: [{ type: 'Type', values: ['Squig Elf'] }] }),
  ]),
  historical(
    'amphibian-atlas',
    'Amphibian Atlas',
    'Traits',
    all('Skin', ['Amphibian Red', 'Amphibian Green', 'Amphibian Purple']),
  ),
  historical(
    'machine-learning',
    'Machine Learning',
    'Traits',
    all('Skin', ['Robot', 'Dark Robot']),
  ),
  historical(
    'afterlife',
    'Afterlife Studies',
    'Traits',
    all('Skin', ['Zombie', 'Dark Zombie']),
  ),
  historical(
    'crystal-clear',
    'Crystal Clear',
    'Traits',
    all('Skin', ['Crystal', 'Crystal Elf']),
    'Hard',
  ),
  historical(
    'suit-yourself',
    'Suit Yourself',
    'Traits',
    all('Body', ['White Suit', 'Black Suit', 'Brown Suit']),
    'Hard',
  ),
  historical(
    'space-program',
    'Ugly Space Program',
    'Weird',
    all('Body', ['White Astronaut', 'Black Astronaut']),
    'Hard',
  ),
  historical(
    'splash-notes',
    'Splash Notes',
    'Traits',
    all('Background', ['Green Splash', 'Pink Splash', 'Purple Splash']),
  ),
  historical(
    'portal-tour',
    'Portal Tour',
    'Traits',
    [
      unique('Background', 4, {
        traits: [
          {
            type: 'Background',
            values: [
              'Portal',
              'Yellow Portal',
              'Light Blue Portal',
              'Pink Portal',
              'Orange Portal',
              'Grey Portal',
              'Purple Portal',
              'Green Portal',
            ],
          },
        ],
      }),
    ],
    'Hard',
  ),
  historical(
    'eyes-wide',
    'Eyes Wide Ugly',
    'Variety',
    [unique('Eyes', 10)],
    'Hard',
  ),
  historical('many-faces', 'Many Faces', 'Variety', [unique('Mouth', 8)]),
  historical(
    'wardrobe-malfunction',
    'Wardrobe Malfunction',
    'Variety',
    [unique('Body', 20)],
    'Hard',
  ),
  historical(
    'hat-lab',
    'Hat Laboratory',
    'Variety',
    [unique('Head', 25)],
    'Hard',
  ),
  historical(
    'species-survey',
    'Species Survey',
    'Variety',
    [unique('Type', 5)],
    'Hard',
  ),
  historical('skin-deep', 'Skin Deep', 'Variety', [unique('Skin', 10)], 'Hard'),
  historical('background-check', 'Background Check', 'Variety', [
    unique('Background', 10),
  ]),
  historical(
    'special-interest',
    'Special Interest',
    'Variety',
    [unique('Special', 8)],
    'Hard',
  ),
  historical(
    'triple-vision',
    'Triple Vision',
    'Traits',
    all('Eyes', ['Triple', 'Triple Lashes', 'Sleepy Triple']),
  ),
  historical(
    'laser-lab',
    'Laser Laboratory',
    'Traits',
    all('Special', ['Green Laser', 'Yellow Laser', 'Multi Laser']),
    'Hard',
  ),
  historical(
    'pet-project',
    'Pet Project',
    'Weird',
    all('Special', ['Piranha', 'Parakeet', 'Dino']),
    'Hard',
  ),
  historical(
    'mood-board',
    'Mood Board',
    'Starter',
    all('Mouth', ['Smile', 'Sad', 'Afraid']),
    'Easy',
  ),
  historical(
    'rainy-day',
    'Rainy Day Research',
    'Weird',
    [trait('Head', 'Umbrella Hat'), trait('Body', 'Diving Suit')],
    'Hard',
  ),
  historical(
    'gold-standard',
    'Gold Standard',
    'Weird',
    [trait('Skin', 'Gold'), trait('Mouth', 'Gold Duck')],
    'Hard',
  ),
  historical(
    'eyes-master',
    'Eye Encyclopedia',
    'Mastery',
    [unique('Eyes', 19)],
    'Insane',
  ),
  historical(
    'body-master',
    'Wardrobe Archive',
    'Mastery',
    [unique('Body', 106)],
    'Insane',
  ),
  historical(
    'head-master',
    'Head Office',
    'Mastery',
    [unique('Head', 125)],
    'Insane',
  ),
  historical(
    'static-signal',
    'Static Signal',
    'Hidden',
    [trait('Eyes', 'Gold Terminator'), trait('Head', 'Atomic')],
    'Insane',
    true,
  ),
  historical(
    'late-night',
    'Late Night Television',
    'Hidden',
    all('Body', ['Beavis Tee', 'Butthead Tee']),
    'Hard',
    true,
  ),
  current('room-for-one', 'Room for One', 'Starter', [count(1)], 'Easy'),
  current('crowded-lab', 'Crowded Laboratory', 'Hoarding', [count(10)]),
  current('hoarder-rack', 'Hoarder Rack', 'Hoarding', [count(25)], 'Hard'),
  current('specimen-wing', 'Specimen Wing', 'Hoarding', [count(50)], 'Insane'),
  current(
    'ugly-rainbow',
    'Ugly Rainbow',
    'Traits',
    all('Background', ['Purple', 'Green', 'Light Blue', 'Pink', 'Yellow']),
    'Hard',
  ),
  current(
    'suit-rack',
    'Suit Rack',
    'Traits',
    all('Body', ['White Suit', 'Black Suit', 'Brown Suit']),
    'Hard',
  ),
  current('three-eyed-army', 'Three-Eyed Army', 'Traits', [
    count(5, {
      traits: [
        {
          type: 'Eyes',
          values: [
            'Triple',
            'Triple Lashes',
            'Sleepy Triple',
            'Angry Triple',
            'Angry Triple Lashes',
          ],
        },
      ],
    }),
  ]),
  current('old-guard', 'Old Guard', 'OG', [count(5, { og: true })]),
  current(
    'legend-in-residence',
    'Legend in Residence',
    'Legendary',
    [count(1, { legendary: true })],
    'Hard',
  ),
  current(
    'five-species',
    'Five Species, One Home',
    'Variety',
    [unique('Type', 5)],
    'Hard',
  ),
  current(
    'purple-wardrobe',
    'Purple Wardrobe',
    'Weird',
    [unique('Body', 5, { traits: [{ type: 'Skin', values: ['Purple'] }] })],
    'Hard',
  ),
  current(
    'colour-clash',
    'Colour Clash',
    'Variety',
    [unique('Skin', 8)],
    'Hard',
  ),
  current(
    'quiet-room',
    'The Quiet Room',
    'Hidden',
    [trait('Mouth', 'Sewn', 3), trait('Mouth', 'Tape', 3)],
    'Hard',
    true,
  ),
];
export function verifyCatalog() {
  const errors: string[] = [];
  if (
    canonicalTokens.length !== 4444 ||
    new Set(canonicalTokens.map((t) => t.tokenId)).size !== 4444
  )
    errors.push('TOKEN_DENOMINATOR');
  if (new Set(collectionSets.map((s) => s.key)).size !== collectionSets.length)
    errors.push('DUPLICATE_SET_KEY');
  for (const s of collectionSets)
    for (const r of s.requirements) {
      if (r.count < 1) errors.push(`${s.key}:INVALID_THRESHOLD`);
      for (const t of r.filter?.traits ?? [])
        for (const v of t.values)
          if (!traitCatalog.some((c) => c.type === t.type && c.value === v))
            errors.push(`${s.key}:INVALID_TRAIT`);
    }
  return errors;
}
