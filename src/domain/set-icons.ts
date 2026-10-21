import { evaluateRequirement, type DexToken, type SetDefinition } from './dex';

// Approved artwork extracted byte-for-byte from UglyDex_Icon_Tables.html.
export const setIcons: Record<string, string> = {
  'first-specimen': '/icons/sets/first-specimen.png',
  'field-notes': '/icons/sets/field-notes.png',
  'strange-company': '/icons/sets/strange-company.png',
  'deep-archive': '/icons/sets/deep-archive.png',
  'living-library': '/icons/sets/living-library.png',
  'og-curious': '/icons/sets/og-curious.png',
  'og-problem': '/icons/sets/og-problem.png',
  'original-archive': '/icons/sets/original-archive.png',
  'legendary-encounter': '/icons/sets/legendary-encounter.png',
  'legend-lore': '/icons/sets/legend-lore.png',
  'purple-people': '/icons/sets/purple-people.png',
  'elf-research': '/icons/sets/elf-research.png',
  'amphibian-atlas': '/icons/sets/amphibian-atlas.png',
  'machine-learning': '/icons/sets/machine-learning.png',
  afterlife: '/icons/sets/afterlife.png',
  'crystal-clear': '/icons/sets/crystal-clear.png',
  'suit-yourself': '/icons/sets/suit-yourself.png',
  'space-program': '/icons/sets/space-program.png',
  'splash-notes': '/icons/sets/splash-notes.png',
  'portal-tour': '/icons/sets/portal-tour.png',
  'eyes-wide': '/icons/sets/eyes-wide.png',
  'many-faces': '/icons/sets/many-faces.png',
  'wardrobe-malfunction': '/icons/sets/wardrobe-malfunction.png',
  'hat-lab': '/icons/sets/hat-lab.png',
  'species-survey': '/icons/sets/species-survey.png',
  'skin-deep': '/icons/sets/skin-deep.png',
  'background-check': '/icons/sets/background-check.png',
  'special-interest': '/icons/sets/special-interest.png',
  'triple-vision': '/icons/sets/triple-vision.png',
  'laser-lab': '/icons/sets/laser-lab.png',
  'pet-project': '/icons/sets/pet-project.png',
  'mood-board': '/icons/sets/mood-board.png',
  'rainy-day': '/icons/sets/rainy-day.png',
  'gold-standard': '/icons/sets/gold-standard.png',
  'eyes-master': '/icons/sets/eyes-master.png',
  'body-master': '/icons/sets/body-master.png',
  'head-master': '/icons/sets/head-master.png',
  'static-signal': '/icons/sets/static-signal.png',
  'late-night': '/icons/sets/late-night.png',
  'room-for-one': '/icons/sets/room-for-one.png',
  'crowded-lab': '/icons/sets/crowded-lab.png',
  'hoarder-rack': '/icons/sets/hoarder-rack.png',
  'specimen-wing': '/icons/sets/specimen-wing.png',
  'ugly-rainbow': '/icons/sets/ugly-rainbow.png',
  'suit-rack': '/icons/sets/suit-rack.png',
  'three-eyed-army': '/icons/sets/three-eyed-army.png',
  'old-guard': '/icons/sets/old-guard.png',
  'legend-in-residence': '/icons/sets/legend-in-residence.png',
  'five-species': '/icons/sets/five-species.png',
  'purple-wardrobe': '/icons/sets/purple-wardrobe.png',
  'colour-clash': '/icons/sets/colour-clash.png',
  'quiet-room': '/icons/sets/quiet-room.png',
};
export type SetIconData = {
  key: string;
  name: string;
  icon: string;
  description: string;
};

// A match means this Squig contributes to a requirement, not that its owner
// has completed the whole set. Never expose secret sets through public cards.
export function matchingSetIcons(
  token: DexToken,
  sets: SetDefinition[],
): SetIconData[] {
  return sets
    .filter(
      (s) =>
        !s.hidden &&
        s.requirements.some((r) => evaluateRequirement(r, [token]).count > 0),
    )
    .sort(
      (a, b) =>
        Number(b.requirements.some((r) => !!r.filter)) -
        Number(a.requirements.some((r) => !!r.filter)),
    )
    .map((s) => ({
      key: s.key,
      name: s.name,
      icon: setIcons[s.key] ?? '/icons/sets/first-specimen.png',
      description: s.description,
    }));
}
