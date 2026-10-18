import 'server-only';
import { readFileSync } from 'node:fs';
import type { ShareStyle } from '@/domain/share-styles';

const backgrounds = {
  clean: 'assets/share-backgrounds/clean.png',
  ugly: 'assets/share-backgrounds/ugly.png',
  stats: 'assets/share-backgrounds/intergalactic.png',
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
