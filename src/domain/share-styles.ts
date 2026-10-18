// Keep the persisted `stats` identifier compatible with existing preferences and links.
export const shareStyleLabels = {
  clean: 'Clean',
  ugly: 'Ugly',
  stats: 'Intergalactic',
} as const;
export type ShareStyle = keyof typeof shareStyleLabels;

export function resolveShareStyle(
  selected: ShareStyle | undefined,
  saved: ShareStyle | undefined,
): ShareStyle {
  return selected ?? saved ?? 'clean';
}
