import { z } from 'zod';
export const COSMETIC_VERSION = 'uglydex-cosmetics-v1';
export const cosmeticKinds = [
  'PROFILE_THEME',
  'PROFILE_ACCENT',
  'CARD_FRAME',
  'GALLERY_STYLE',
  'SHARE_STYLE',
] as const;
export type CosmeticKind = (typeof cosmeticKinds)[number];
export const cosmeticCatalog: {
  id: string;
  kind: CosmeticKind;
  name: string;
  source: 'FREE' | 'ACHIEVEMENT' | 'SET' | 'OG' | 'LEGENDARY';
  value: string;
}[] = [
  {
    id: 'theme-classic',
    kind: 'PROFILE_THEME',
    name: 'Classic Ugly',
    source: 'FREE',
    value: 'classic',
  },
  {
    id: 'theme-labs',
    kind: 'PROFILE_THEME',
    name: 'Ugly Labs',
    source: 'FREE',
    value: 'labs',
  },
  {
    id: 'theme-minimal',
    kind: 'PROFILE_THEME',
    name: 'Minimal',
    source: 'FREE',
    value: 'minimal',
  },
  {
    id: 'accent-moss',
    kind: 'PROFILE_ACCENT',
    name: 'Moss',
    source: 'FREE',
    value: 'moss',
  },
  {
    id: 'accent-bone',
    kind: 'PROFILE_ACCENT',
    name: 'Bone',
    source: 'FREE',
    value: 'bone',
  },
  {
    id: 'accent-violet',
    kind: 'PROFILE_ACCENT',
    name: 'Violet',
    source: 'FREE',
    value: 'violet',
  },
  {
    id: 'accent-amber',
    kind: 'PROFILE_ACCENT',
    name: 'Achievement amber',
    source: 'ACHIEVEMENT',
    value: 'amber',
  },
  {
    id: 'frame-classic',
    kind: 'CARD_FRAME',
    name: 'Classic frame',
    source: 'FREE',
    value: 'classic',
  },
  {
    id: 'frame-og',
    kind: 'CARD_FRAME',
    name: 'OG frame',
    source: 'OG',
    value: 'og',
  },
  {
    id: 'frame-legendary',
    kind: 'CARD_FRAME',
    name: 'Legendary frame',
    source: 'LEGENDARY',
    value: 'legendary',
  },
  {
    id: 'frame-set',
    kind: 'CARD_FRAME',
    name: 'Set collector frame',
    source: 'SET',
    value: 'set',
  },
  {
    id: 'gallery-classic',
    kind: 'GALLERY_STYLE',
    name: 'Classic exhibition',
    source: 'FREE',
    value: 'classic',
  },
  {
    id: 'gallery-labs',
    kind: 'GALLERY_STYLE',
    name: 'Laboratory exhibition',
    source: 'FREE',
    value: 'labs',
  },
  {
    id: 'gallery-trophy',
    kind: 'GALLERY_STYLE',
    name: 'Trophy exhibition',
    source: 'SET',
    value: 'trophy',
  },
  {
    id: 'share-clean',
    kind: 'SHARE_STYLE',
    name: 'Clean',
    source: 'FREE',
    value: 'clean',
  },
  {
    id: 'share-ugly',
    kind: 'SHARE_STYLE',
    name: 'Ugly',
    source: 'FREE',
    value: 'ugly',
  },
  {
    id: 'share-stats',
    kind: 'SHARE_STYLE',
    name: 'Stats',
    source: 'FREE',
    value: 'stats',
  },
];
export const appearanceSchema = z
  .object({
    PROFILE_THEME: z.string().max(50),
    PROFILE_ACCENT: z.string().max(50),
    CARD_FRAME: z.string().max(50),
    GALLERY_STYLE: z.string().max(50),
    SHARE_STYLE: z.string().max(50),
  })
  .strict();
export type Appearance = {
  theme: string;
  accent: string;
  frame: string;
  gallery: string;
  share: 'clean' | 'ugly' | 'stats';
};
export const defaultAppearance: Appearance = {
  theme: 'classic',
  accent: 'moss',
  frame: 'classic',
  gallery: 'classic',
  share: 'clean',
};
export function resolveAppearance(
  preferences: { kind: string; cosmeticId: string }[],
  unlocked: string[],
): Appearance {
  const selected = (kind: CosmeticKind, fallback: string) => {
    const id = preferences.find((p) => p.kind === kind)?.cosmeticId;
    return (
      cosmeticCatalog.find(
        (c) => c.id === id && c.kind === kind && unlocked.includes(c.id),
      )?.value ?? fallback
    );
  };
  return {
    theme: selected('PROFILE_THEME', 'classic'),
    accent: selected('PROFILE_ACCENT', 'moss'),
    frame: selected('CARD_FRAME', 'classic'),
    gallery: selected('GALLERY_STYLE', 'classic'),
    share: selected('SHARE_STYLE', 'clean') as Appearance['share'],
  };
}
export const accentColors: Record<string, string> = {
  moss: '#c6e5b5',
  bone: '#eee1c3',
  violet: '#dac6ff',
  amber: '#f5d28a',
};
export function appearanceClass(a: Appearance) {
  return `personal-showcase theme-${a.theme} accent-${a.accent} frame-${a.frame} gallery-style-${a.gallery}`;
}
