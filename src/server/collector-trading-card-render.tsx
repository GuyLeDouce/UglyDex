import 'server-only';
import { ImageResponse } from 'next/og';
import type { ShareCard } from '@/domain/sharing';
import { cardFonts } from './trading-card-render';
import { TRADING_CARD_WIDTH, TRADING_CARD_HEIGHT } from '@/domain/trading-card';
import { CollectorCardFace } from '@/components/collector-card-face';

export function renderCollectorTradingCard(
  card: ShareCard,
  artwork: string | null | undefined,
) {
  return new ImageResponse(
    <CollectorCardFace card={card} artwork={artwork} print />,
    {
      width: TRADING_CARD_WIDTH,
      height: TRADING_CARD_HEIGHT,
      fonts: cardFonts(),
    },
  );
}
