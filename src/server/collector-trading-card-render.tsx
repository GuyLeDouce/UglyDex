/* eslint-disable @next/next/no-img-element -- ImageResponse uses native image primitives. */
import 'server-only';
import { ImageResponse } from 'next/og';
import type { CSSProperties } from 'react';
import type { ShareCard } from '@/domain/sharing';
import { cardFonts } from './trading-card-render';
import { TRADING_CARD_WIDTH, TRADING_CARD_HEIGHT } from '@/domain/trading-card';

// Same print dimensions and material masks as the Squig cards. The profile has
// a branded finish, not an invented NFT rarity. All numbers are projected upstream.
const box = (
  left: number,
  top: number,
  width: number,
  height: number,
): CSSProperties => ({
  display: 'flex',
  position: 'absolute',
  left,
  top,
  width,
  height,
});
const gold = '#ffe32b',
  blue = '#168bff',
  ink = '#101e35';
const display = { fontFamily: 'Lilita', fontWeight: 400 } as const;
const number = (value: number | null) =>
  value === null ? 'Pending' : value.toLocaleString('en-US');
export function renderCollectorTradingCard(
  card: ShareCard,
  artwork: string | null | undefined,
) {
  const c = card.collectorCard;
  if (!c) throw new Error('COLLECTOR_CARD_REQUIRED');
  if (c.avatar && !artwork) throw new Error('TRADING_CARD_ARTWORK_UNAVAILABLE');
  const stats = [
    ['SQUIGS DISCOVERED', number(c.discovered)],
    ['TRAITS DISCOVERED', number(c.traits)],
    ['SETS ACHIEVED', number(c.historicalSets)],
    ['ACHIEVEMENTS COMPLETE', number(c.achievements)],
  ];
  return new ImageResponse(
    <div
      style={{
        display: 'flex',
        position: 'relative',
        width: '100%',
        height: '100%',
        background: '#124579',
        color: ink,
        fontFamily: 'Montserrat',
        fontWeight: 600,
      }}
    >
      <div
        style={{
          ...box(12, 12, 1476, 2076),
          borderRadius: 80,
          border: '5px solid #c5ecff',
          background:
            'linear-gradient(120deg,#134d94 0%,#168bff 22%,#bcecff 36%,#ffe32b 49%,#168bff 65%,#a3eaff 80%,#124f9e 100%)',
        }}
      />
      <div
        style={{
          ...box(45, 45, 1410, 2010),
          borderRadius: 56,
          border: `4px solid ${ink}`,
          background: ink,
        }}
      />
      <div
        style={{
          ...box(60, 60, 1380, 1980),
          borderRadius: 46,
          background: '#fbf4da',
          border: `2px solid ${gold}`,
        }}
      />
      <div
        style={{
          ...box(79, 86, 1342, 1928),
          borderRadius: 32,
          border: `2px solid ${blue}`,
        }}
      />
      <div
        style={{
          ...box(270, 48, 960, 88),
          ...display,
          borderRadius: 44,
          alignItems: 'center',
          justifyContent: 'center',
          border: '5px solid #fff6a5',
          background: gold,
          fontSize: 52,
          letterSpacing: 8,
        }}
      >
        UGLYDEX COLLECTOR
      </div>
      <div
        style={{
          ...box(120, 155, 860, 112),
          ...display,
          alignItems: 'center',
          fontSize:
            card.title.length > 26 ? 39 : card.title.length > 16 ? 53 : 76,
          overflow: 'hidden',
          lineHeight: 1.05,
        }}
      >
        {card.title}
      </div>
      <div
        style={{
          ...box(1000, 154, 380, 110),
          borderLeft: '3px solid #a6adab',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
        }}
      >
        <span style={{ ...display, fontSize: 70 }}>
          {c.completion === null ? '—' : c.completion.toFixed(1) + '%'}
        </span>
        <span style={{ fontSize: 22, letterSpacing: 2 }}>
          FIELD GUIDE MASTERY
        </span>
      </div>
      <div
        style={{
          ...box(143, 278, 1214, 1214),
          borderRadius: 26,
          border: `4px solid ${ink}`,
          background: 'linear-gradient(125deg,#168bff,#b9f0ff,#ffe32b,#168bff)',
        }}
      />
      {artwork ? (
        <img
          src={artwork}
          alt=""
          style={{
            ...box(160, 295, 1180, 1180),
            objectFit: 'contain',
            background: ink,
            border: `3px solid ${ink}`,
          }}
        />
      ) : (
        <div
          style={{
            ...box(160, 295, 1180, 1180),
            background: ink,
            color: gold,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
          }}
        >
          <span style={{ ...display, fontSize: 220 }}>UGLYDEX</span>
          <span style={{ fontSize: 30 }}>YOUR STORY STARTS HERE</span>
        </div>
      )}
      <div
        style={{
          ...box(120, 1514, 1260, 70),
          borderBottom: `3px solid ${blue}`,
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ ...display, fontSize: 42 }}>YOUR UGLY LEGACY</span>
        <span style={{ fontSize: 27 }}>
          {c.avatarTokenId
            ? `AVATAR SQUIG #${c.avatarTokenId}`
            : 'COLLECTOR FIELD RECORD'}
        </span>
      </div>
      <div
        style={{
          ...box(120, 1601, 1260, 90),
          background: gold,
          border: `4px solid ${blue}`,
          borderRadius: 22,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 28,
        }}
      >
        <span style={{ fontSize: 32, letterSpacing: 3 }}>
          ACHIEVEMENT LEVEL
        </span>
        <span style={{ ...display, fontSize: 65 }}>{number(c.level)}</span>
      </div>
      {stats.map(([label, value], i) => (
        <div
          key={label}
          style={{
            ...box(i % 2 ? 770 : 125, 1722 + Math.floor(i / 2) * 112, 605, 102),
            borderBottom: '1px solid #acb6af',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          <span style={{ fontSize: 23, letterSpacing: 1.5 }}>{label}</span>
          <span style={{ ...display, fontSize: 51, color: '#125aa2' }}>
            {value}
          </span>
        </div>
      ))}
      <div
        style={{
          ...box(95, 1986, 1310, 50),
          borderRadius: 15,
          background: gold,
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 22px',
        }}
      >
        <span style={{ ...display, fontSize: 32 }}>UGLY LABS</span>
        <span style={{ fontSize: 22, letterSpacing: 2 }}>
          EVERY COLLECTOR HAS A STORY.
        </span>
        <span style={{ fontSize: 22 }}>UGLYDEX</span>
      </div>
    </div>,
    {
      width: TRADING_CARD_WIDTH,
      height: TRADING_CARD_HEIGHT,
      fonts: cardFonts(),
    },
  );
}
