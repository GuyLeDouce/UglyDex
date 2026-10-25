// Keep the persisted `stats` identifier compatible with existing preferences and links.
export const shareStyleLabels = {
  clean: 'Clean',
  ugly: 'Ugly',
  stats: 'Intergalactic',
  'neon-after-dark': 'Neon After Dark',
  'nature-city': 'Nature City',
  'planet-ugly': 'Planet Ugly',
  'forgotten-subway': 'Forgotten Subway',
  'ugly-foundry': 'Ugly Foundry',
  'fungal-kingdom': 'Fungal Kingdom',
  'uglywave-1987': 'UglyWave 1987',
  '90s-chaos': "90's Chaos",
  'ugly-citadel': 'Ugly Citadel',
} as const;
export type ShareStyle = keyof typeof shareStyleLabels;

export function resolveShareStyle(
  selected: ShareStyle | undefined,
  saved: ShareStyle | undefined,
): ShareStyle {
  return selected ?? saved ?? 'clean';
}
