import 'server-only';
import { readFileSync } from 'node:fs';
import { ImageResponse } from 'next/og';
import { TrophyCardFace } from '@/components/trophy-card-face';
import type { TrophyCardData } from '@/domain/trophy-card';
import { achievementBadgeFile } from './achievement-badge-assets';
import { cardFonts } from './trading-card-render';
export function renderTrophyCard(card: TrophyCardData, avatar?: string | null) {
  const file = achievementBadgeFile(
    card.kind === 'achievement' ? card.key : 'collector-discoveries-20',
  );
  if (!file || (card.avatarTokenId && !avatar))
    throw new Error('TRADING_CARD_ARTWORK_UNAVAILABLE');
  const badge =
    'data:image/png;base64,' + readFileSync(file).toString('base64');
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
