/* eslint-disable @next/next/no-img-element -- Shared HTML and ImageResponse card face. */
import { artworkUrl } from '@/domain/artwork-delivery';
import type { CSSProperties } from 'react';
import type { TrophyCardData } from '@/domain/trophy-card';
import {
  tradingCardPalettes,
  TRADING_BAR_INK,
} from '@/domain/trading-card-palette';

// One layout for the lightweight album and full-resolution export. Coordinates
// retain the Squig card's print proportions and existing interactive foil masks.
export function TrophyCardFace({
  card,
  width = 300,
  badge = card.badgeUrl,
  avatar,
  print = false,
}: {
  card: TrophyCardData;
  width?: number;
  badge?: string;
  avatar?: string | null;
  print?: boolean;
}) {
  const scale = width / 1500;
  const p = tradingCardPalettes[card.rarity];
  const box = (x: number, y: number, w: number, h: number): CSSProperties => ({
    display: 'flex',
    position: 'absolute',
    left: x * scale,
    top: y * scale,
    width: w * scale,
    height: h * scale,
  });
  const display: CSSProperties = {
    fontFamily: print ? 'Lilita' : 'var(--font-lilita-one), sans-serif',
    fontWeight: 400,
  };
  const bar: CSSProperties = {
    background: p.bar,
    color: TRADING_BAR_INK,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22 * scale,
    border: `${3 * scale}px solid ${p.dark}`,
  };
  const displayBadge =
    !print && card.kind === 'set' && badge.startsWith('/icons/sets/')
      ? badge.replace('/icons/sets/', '/icons/sets-card/')
      : badge;
  const portrait =
    avatar ?? (card.avatarTokenId ? artworkUrl(card.avatarTokenId, 96) : null);
  return (
    <div
      className="trophy-card-face"
      style={{
        display: 'flex',
        position: 'relative',
        width,
        height: width * 1.4,
        flexShrink: 0,
        textAlign: 'left',
        color: '#17271e',
        fontFamily: print ? 'Montserrat' : 'var(--font-montserrat), sans-serif',
        fontWeight: 600,
        background: p.dark,
        borderRadius: 80 * scale,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          ...box(12, 12, 1476, 2076),
          borderRadius: 80 * scale,
          border: `${5 * scale}px solid ${p.light}`,
          background: `linear-gradient(120deg,${p.dark},${p.mid},${p.light},${p.mid},${p.dark})`,
        }}
      />
      <div
        style={{
          ...box(48, 48, 1404, 2004),
          borderRadius: 55 * scale,
          background: '#faf3dc',
          border: `${10 * scale}px solid ${p.ink}`,
        }}
      />
      <div
        style={{
          ...box(79, 86, 1342, 1928),
          borderRadius: 32 * scale,
          border: `${2 * scale}px solid ${p.mid}`,
        }}
      />
      <div
        style={{
          ...box(270, 48, 960, 88),
          ...bar,
          ...display,
          borderRadius: 44 * scale,
          fontSize: 46 * scale,
          letterSpacing: 4 * scale,
        }}
      >
        UGLYDEX COLLECTOR
      </div>
      <div
        style={{
          ...box(120, 156, 1260, 110),
          ...display,
          alignItems: 'center',
          fontSize:
            (card.name.length > 28 ? 52 : card.name.length > 20 ? 64 : 78) *
            scale,
          lineHeight: 1.05,
        }}
      >
        {card.name}
      </div>
      <div
        style={{
          ...box(143, 278, 1214, 1214),
          borderRadius: 26 * scale,
          border: `${4 * scale}px solid ${p.dark}`,
          background: `linear-gradient(135deg,${p.ink},#101318,${p.ink})`,
        }}
      />
      <img
        loading={print ? undefined : 'lazy'}
        src={displayBadge}
        alt={card.name + (card.kind === 'set' ? ' set icon' : ' badge')}
        width={1000 * scale}
        height={1000 * scale}
        style={{
          ...box(250, 385, 1000, 1000),
          objectFit: 'contain',
        }}
      />
      <div
        style={{
          ...box(120, 1514, 1260, 70),
          borderBottom: `${3 * scale}px solid ${p.mid}`,
          alignItems: 'center',
          justifyContent: 'space-between',
          ...display,
          fontSize: 38 * scale,
        }}
      >
        <span>
          {card.kind === 'achievement' ? 'ACHIEVEMENT' : 'COMPLETED SET'}
        </span>
        <span>{card.classification.toUpperCase()}</span>
      </div>
      <div
        style={{
          ...box(120, 1601, 1260, 90),
          ...bar,
          fontSize: 30 * scale,
          letterSpacing: 2 * scale,
        }}
      >
        {card.status}
      </div>
      <div
        style={{
          ...box(125, 1714, 1250, 115),
          fontSize: (card.description.length > 115 ? 26 : 30) * scale,
          lineHeight: 1.35,
          alignItems: 'center',
        }}
      >
        {card.description}
      </div>
      {portrait && (
        <img
          loading={print ? undefined : 'lazy'}
          src={portrait}
          alt=""
          width={105 * scale}
          height={105 * scale}
          style={{
            ...box(125, 1850, 105, 105),
            objectFit: 'contain',
            borderRadius: 14 * scale,
            border: `${2 * scale}px solid ${p.mid}`,
          }}
        />
      )}
      <div
        style={{
          ...box(portrait ? 252 : 125, 1845, portrait ? 1120 : 1250, 114),
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 5 * scale,
        }}
      >
        <span style={{ fontSize: 20 * scale, letterSpacing: 2 * scale }}>
          COLLECTED BY
        </span>
        <span
          style={{
            ...display,
            fontSize: (card.collector.length > 28 ? 30 : 40) * scale,
          }}
        >
          {card.collector}
        </span>
      </div>
      <div
        style={{
          ...box(95, 1986, 1310, 50),
          ...bar,
          justifyContent: 'space-between',
          padding: `0 ${22 * scale}px`,
          fontSize: 22 * scale,
        }}
      >
        <span style={{ ...display, fontSize: 30 * scale }}>UGLY LABS</span>
        <span>YOUR UGLY LEGACY</span>
        <span>UGLYDEX</span>
      </div>
    </div>
  );
}
