import { evaluateRequirement, type DexToken, type SetDefinition } from './dex';

// Small, familiar symbols stay legible at 16px without extra artwork downloads.
export const setIcons: Record<string, string> = {
  'first-specimen': '🔎',
  'field-notes': '📝',
  'strange-company': '👥',
  'deep-archive': '🗃️',
  'living-library': '📚',
  'og-curious': '🦴',
  'og-problem': '🏺',
  'original-archive': '📜',
  'legendary-encounter': '⭐',
  'legend-lore': '🌟',
  'purple-people': '👾',
  'elf-research': '🧝',
  'amphibian-atlas': '🐸',
  'machine-learning': '🤖',
  afterlife: '🧟',
  'crystal-clear': '💎',
  'suit-yourself': '👔',
  'space-program': '🚀',
  'splash-notes': '💦',
  'portal-tour': '🌀',
  'eyes-wide': '👀',
  'many-faces': '🎭',
  'wardrobe-malfunction': '👕',
  'hat-lab': '🎩',
  'species-survey': '🧬',
  'skin-deep': '🎨',
  'background-check': '🖼️',
  'special-interest': '✨',
  'triple-vision': '👁️',
  'laser-lab': '⚡',
  'pet-project': '🐾',
  'mood-board': '🙂',
  'rainy-day': '☔',
  'gold-standard': '🪙',
  'eyes-master': '🧐',
  'body-master': '🧥',
  'head-master': '🧢',
  'static-signal': '📡',
  'late-night': '📺',
  'room-for-one': '🏠',
  'crowded-lab': '🧪',
  'hoarder-rack': '🗄️',
  'specimen-wing': '🏛️',
  'ugly-rainbow': '🌈',
  'suit-rack': '🤵',
  'three-eyed-army': '👁️',
  'old-guard': '🛡️',
  'legend-in-residence': '👑',
  'five-species': '🧬',
  'purple-wardrobe': '💜',
  'colour-clash': '🎨',
  'quiet-room': '🤐',
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
      icon: setIcons[s.key] ?? '🔎',
      description: s.description,
    }));
}
