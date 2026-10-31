import 'server-only';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { ShareStyle } from '@/domain/share-styles';

const backgrounds = {
  clean: 'clean.png',
  ugly: 'ugly.png',
  stats: 'intergalactic.png',
  'neon-after-dark': 'neon-after-dark.png',
  'nature-city': 'nature-city.png',
  'planet-ugly': 'planet-ugly.png',
  'forgotten-subway': 'forgotten-subway.png',
  'ugly-foundry': 'ugly-foundry.png',
  'fungal-kingdom': 'fungal-kingdom.png',
  'uglywave-1987': 'uglywave-1987.png',
  '90s-chaos': '90s-chaos.png',
  'ugly-citadel': 'ugly-citadel.png',
} satisfies Record<ShareStyle, string>;
const images = new Map<ShareStyle, string>();

export function shareBackground(style: ShareStyle) {
  if (!images.has(style))
    images.set(
      style,
      'data:image/png;base64,' +
        readFileSync(
          path.join(
            process.cwd(),
            'assets',
            'share-backgrounds',
            backgrounds[style],
          ),
        ).toString('base64'),
    );
  return images.get(style)!;
}
