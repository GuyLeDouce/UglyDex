import 'server-only';
import { readFileSync } from 'node:fs';
import { ImageResponse } from 'next/og';
import { TrophyCardFace } from '@/components/trophy-card-face';
import type { TrophyCardData } from '@/domain/trophy-card';
import { achievementBadgeFile } from './achievement-badge-assets';
import { setIcons } from '@/domain/set-icons';
import { cardFonts } from './trading-card-render';
export function renderTrophyCard(card: TrophyCardData, avatar?: string | null) {
  const file = achievementBadgeFile(
    card.kind === 'achievement' ? card.key : 'collector-discoveries-20',
  );
  const setIcon =
    card.kind === 'set' && setIcons[card.key]
      ? 'data:image/png;base64,' +
        readFileSync('public' + setIcons[card.key]).toString('base64')
      : undefined;
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
      setIcon={setIcon}
      print
    />,
    { width: 1500, height: 2100, fonts: cardFonts() },
  );
}
