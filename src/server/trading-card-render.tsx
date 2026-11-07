/* eslint-disable @next/next/no-img-element -- ImageResponse uses image primitives. */
import 'server-only';
import { ImageResponse } from 'next/og';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CSSProperties } from 'react';
import {
  TRADING_CARD_WIDTH,
  TRADING_CARD_HEIGHT,
  TRADING_CARD_VERSION,
  type TradingCardData,
} from '@/domain/trading-card';

import { tradingCardPalettes } from '@/domain/trading-card-palette';
export { tradingCardPalettes } from '@/domain/trading-card-palette';
let fonts:
  | { name: string; data: Buffer; weight: 400 | 600; style: 'normal' }[]
  | undefined;
function cardFonts() {
  return (fonts ??= [
    {
      name: 'Lilita',
      data: readFileSync(
        join(process.cwd(), 'assets/fonts/LilitaOne-Regular.ttf'),
      ),
      weight: 400,
      style: 'normal',
    },
    {
      name: 'Montserrat',
      data: readFileSync(
        join(process.cwd(), 'assets/fonts/Montserrat-SemiBold.ttf'),
      ),
      weight: 600,
      style: 'normal',
    },
  ]);
}
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
const label = {
  fontFamily: 'Montserrat',
  fontWeight: 600,
  letterSpacing: 3,
} as const;
const display = { fontFamily: 'Lilita', fontWeight: 400 } as const;

export function tradingCardElement(card: TradingCardData, artwork: string) {
  const p = tradingCardPalettes[card.rarity];
  const foil = `linear-gradient(125deg, ${p.dark} 0%, ${p.mid} 15%, ${p.light} 25%, ${p.mid} 34%, ${p.dark} 49%, ${p.mid} 62%, ${p.light} 74%, ${p.mid} 88%, ${p.dark} 100%)`;
  const rarity = card.rarity === 'unclassified' ? 'Unclassified' : card.rarity;
  const legend = card.legendary && card.legend;
  return (
    <div
      style={{
        display: 'flex',
        position: 'relative',
        width: '100%',
        height: '100%',
        background: p.dark,
        color: '#142b24',
        fontFamily: 'Montserrat',
        fontWeight: 600,
      }}
    >
      <div
        style={{
          ...box(12, 12, 1476, 2076),
          borderRadius: 80,
          background: foil,
          border: `5px solid ${p.light}`,
        }}
      />
      <div
        style={{
          ...box(45, 45, 1410, 2010),
          borderRadius: 56,
          border: `4px solid ${p.dark}`,
          background: '#153e30',
        }}
      />
      <div
        style={{
          ...box(61, 61, 1378, 1978),
          borderRadius: 44,
          background: 'linear-gradient(145deg, #fff9e9, #f4e9c9)',
          border: `3px solid ${p.light}`,
        }}
      />
      {/* Fine double rails and registration diamonds create a physical frame without altering the art. */}
      <div
        style={{
          ...box(78, 85, 1344, 1930),
          border: `2px solid ${p.mid}`,
          borderRadius: 34,
        }}
      />
      {[175, 600, 1025, 1450, 1875].map((y) => (
        <div
          key={y}
          style={{
            ...box(23, y, 15, 15),
            transform: 'rotate(45deg)',
            background: p.light,
            border: `2px solid ${p.dark}`,
          }}
        />
      ))}
      {[175, 600, 1025, 1450, 1875].map((y) => (
        <div
          key={y}
          style={{
            ...box(1462, y, 15, 15),
            transform: 'rotate(45deg)',
            background: p.light,
            border: `2px solid ${p.dark}`,
          }}
        />
      ))}
      <div
        style={{
          ...box(270, 48, 960, 88),
          background: '#123f2c',
          border: `5px solid ${p.light}`,
          borderRadius: 44,
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff5dc',
          ...display,
          fontSize: 55,
          letterSpacing: 6,
        }}
      >
        SQUIGS RELOADED
      </div>
      <div
        style={{
          ...box(118, 156, 850, 98),
          alignItems: 'center',
          ...display,
          fontSize: 110,
        }}
      >
        <span style={{ color: '#151c19' }}>Squig</span>
        <span style={{ marginLeft: 25, color: '#164e35' }}>
          #{card.tokenId}
        </span>
      </div>
      <div
        style={{
          ...box(1000, 154, 365, 110),
          borderLeft: '3px solid #b5b39a',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            display: 'flex',
            ...display,
            fontSize: 82,
            lineHeight: 1,
            color: '#164e35',
          }}
        >
          {card.uglyPoints ?? '—'}
        </div>
        <div style={{ display: 'flex', ...label, fontSize: 25, marginTop: 4 }}>
          UGLYPOINTS
        </div>
      </div>
      <div
        style={{
          ...box(143, 278, 1214, 1214),
          background: foil,
          borderRadius: 27,
          border: `4px solid ${p.dark}`,
          padding: 13,
        }}
      >
        <img
          src={artwork}
          width={1180}
          height={1180}
          style={{
            objectFit: 'contain',
            background: '#fff',
            border: '3px solid #143b2d',
          }}
          alt={`Original Squig #${card.tokenId}`}
        />
      </div>
      <div
        style={{
          ...box(120, 1504, 1260, 80),
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: `3px solid ${p.mid}`,
        }}
      >
        <div
          style={{
            display: 'flex',
            ...display,
            fontSize: 49,
            color: '#164e35',
            textTransform: 'uppercase',
          }}
        >
          {card.legendary ? 'LEGENDARY 1/1' : card.type}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          {card.og && (
            <div
              style={{
                display: 'flex',
                border: '3px solid #164e35',
                borderRadius: 24,
                padding: '4px 19px',
                ...display,
                fontSize: 40,
              }}
            >
              OG
            </div>
          )}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: foil,
              border: `3px solid ${p.dark}`,
              borderRadius: 22,
              padding: '8px 24px',
              color: p.ink,
              ...display,
              fontSize: 40,
              textTransform: 'uppercase',
              gap: 18,
            }}
          >
            <span
              style={{
                width: 22,
                height: 22,
                background: p.light,
                border: `3px solid ${p.dark}`,
                transform: 'rotate(45deg)',
              }}
            />
            {rarity}
          </div>
        </div>
      </div>
      <div
        style={{
          ...box(120, 1601, 1260, 90),
          background: '#123f2c',
          border: `4px solid ${p.mid}`,
          borderRadius: 22,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 35,
          color: '#fff5dc',
        }}
      >
        <span style={{ ...label, fontSize: 36 }}>MAW RANK</span>
        <span style={{ ...display, fontSize: 68, color: p.light }}>
          #{card.mawRank ?? '—'}
        </span>
        {card.legendary && card.mawRank === 1 && (
          <span style={{ ...label, fontSize: 23, letterSpacing: 1 }}>
            SHARED
          </span>
        )}
      </div>
      {legend ? (
        <div
          style={{
            ...box(120, 1722, 1260, 240),
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            border: `2px solid ${p.mid}`,
            borderRadius: 24,
            background: 'linear-gradient(135deg, #fff9e4, #f2df9c)',
          }}
        >
          <div
            style={{
              display: 'flex',
              ...label,
              fontSize: 24,
              letterSpacing: 7,
              color: p.dark,
            }}
          >
            ONE OF A KIND
          </div>
          <div
            style={{
              display: 'flex',
              ...display,
              fontSize: legend.length > 20 ? 60 : 78,
              marginTop: 12,
              color: p.ink,
            }}
          >
            {legend}
          </div>
          <div
            style={{
              display: 'flex',
              ...label,
              fontSize: 25,
              marginTop: 16,
              letterSpacing: 1,
            }}
          >
            Every Squig has a story. This one is a legend.
          </div>
        </div>
      ) : (
        <div
          style={{
            ...box(126, 1712, 1248, 270),
            flexWrap: 'wrap',
            alignContent: 'flex-start',
            columnGap: 32,
          }}
        >
          {card.traits.map((trait) => (
            <div
              key={trait.traitType}
              style={{
                display: 'flex',
                flexDirection: 'column',
                width: 608,
                height: 66,
                borderBottom: '1px solid #b9baa4',
                paddingBottom: 4,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  ...label,
                  fontSize: 20,
                  letterSpacing: 2,
                  color: '#52654c',
                  textTransform: 'uppercase',
                }}
              >
                {trait.traitType}
              </div>
              <div
                style={{
                  display: 'flex',
                  ...display,
                  fontSize: trait.value.length > 22 ? 35 : 42,
                  lineHeight: 1,
                  color: '#182820',
                  marginTop: 3,
                }}
              >
                {trait.value}
              </div>
            </div>
          ))}
          {!card.traits.length && (
            <div
              style={{
                display: 'flex',
                fontSize: 35,
                margin: '60px auto',
                color: '#52654c',
              }}
            >
              Traits not indexed
            </div>
          )}
        </div>
      )}
      <div
        style={{
          ...box(95, 1986, 1310, 50),
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          borderRadius: 15,
          background: '#123f2c',
          color: '#fff5dc',
        }}
      >
        <span style={{ ...display, fontSize: 32, letterSpacing: 3 }}>
          UGLY LABS
        </span>
        <span style={{ ...label, fontSize: 23 }}>ETHEREUM · ORIGINAL ART</span>
        <span style={{ ...label, fontSize: 24 }}>
          #{String(card.tokenId).padStart(4, '0')} · V{TRADING_CARD_VERSION}
        </span>
      </div>
    </div>
  );
}
export function renderTradingCard(
  card: TradingCardData,
  artwork: string | null | undefined,
) {
  if (!artwork) throw new Error('TRADING_CARD_ARTWORK_UNAVAILABLE');
  return new ImageResponse(tradingCardElement(card, artwork), {
    width: TRADING_CARD_WIDTH,
    height: TRADING_CARD_HEIGHT,
    fonts: cardFonts(),
  });
}
