import 'server-only';
import { readFileSync } from 'node:fs';
import sharp from 'sharp';
import { ImageResponse } from 'next/og';
import { TrophyCardFace } from '@/components/trophy-card-face';
import type { TrophyCardData } from '@/domain/trophy-card';
import { achievementBadgeFile } from './achievement-badge-assets';
import { setIcons } from '@/domain/set-icons';
import { cardFonts } from './trading-card-render';
export async function renderTrophyCard(
  card: TrophyCardData,
  avatar?: string | null,
) {
  const file =
    card.kind === 'set'
      ? 'public' + (setIcons[card.key] ?? '/icons/sets/first-specimen.png')
      : achievementBadgeFile(card.key);
  if (!file || (card.avatarTokenId && !avatar))
    throw new Error('TRADING_CARD_ARTWORK_UNAVAILABLE');
  const source = readFileSync(file);
  const artwork =
    card.kind === 'set'
      ? await sharp(source)
          .resize(1000, 1000, {
            fit: 'contain',
            kernel: 'lanczos3',
            withoutEnlargement: true,
            background: '#0000',
          })
          .png()
          .toBuffer()
      : source;
  const badge = 'data:image/png;base64,' + artwork.toString('base64');
  return new ImageResponse(
    <TrophyCardFace
      card={card}
      width={1500}
      badge={badge}
      avatar={avatar}
      print
    />,
    { width: 1500, height: 2100, fonts: cardFonts() },
  );
}
