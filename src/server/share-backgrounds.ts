import 'server-only';
import { readFileSync } from 'node:fs';
import type { ShareStyle } from '@/domain/share-styles';

const backgrounds = {
  clean: 'assets/share-backgrounds/clean.png',
  ugly: 'assets/share-backgrounds/ugly.png',
  stats: 'assets/share-backgrounds/intergalactic.png',
  'neon-after-dark': 'assets/share-backgrounds/neon-after-dark.png',
  'nature-city': 'assets/share-backgrounds/nature-city.png',
  'planet-ugly': 'assets/share-backgrounds/planet-ugly.png',
  'forgotten-subway': 'assets/share-backgrounds/forgotten-subway.png',
  'ugly-foundry': 'assets/share-backgrounds/ugly-foundry.png',
  'fungal-kingdom': 'assets/share-backgrounds/fungal-kingdom.png',
  'uglywave-1987': 'assets/share-backgrounds/uglywave-1987.png',
  '90s-chaos': 'assets/share-backgrounds/90s-chaos.png',
  'ugly-citadel': 'assets/share-backgrounds/ugly-citadel.png',
} satisfies Record<ShareStyle, string>;
const images = new Map<ShareStyle, string>();

export function shareBackground(style: ShareStyle) {
  if (!images.has(style))
    images.set(
      style,
      'data:image/png;base64,' +
        readFileSync(backgrounds[style]).toString('base64'),
    );
  return images.get(style)!;
}
