/* eslint-disable @next/next/no-img-element -- ImageResponse requires native image primitives. */
import 'server-only';
import { ImageResponse } from 'next/og';
import type { ShareCard, ShareSpec } from '@/domain/sharing';
import { accentColors } from '@/domain/cosmetics';
// ImageResponse bundles its font; no dependency on a desktop font installation.
export function renderShare(
  card: ShareCard,
  spec: Pick<ShareSpec, 'ratio' | 'template'>,
  art: Record<number, string | null>,
) {
  if (card.appearance && spec.template === 'clean')
    spec = { ...spec, template: card.appearance.share };
  const text = (value: string) =>
    value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\x20-\x7e]/g, ' ')
      .trim();
  card = {
    ...card,
    title: text(card.title) || 'UglyDex',
    eyebrow: text(card.eyebrow),
    description: text(card.description),
    stats: card.stats.map(text),
    badges: card.badges.map(text),
  };
  const square = spec.ratio === 'square',
    width = square ? 1080 : 1200,
    height = square ? 1080 : 630,
    accent = card.appearance
      ? (accentColors[card.appearance.accent] ?? '#c6e5b5')
      : spec.template === 'ugly'
        ? '#ecfa72'
        : '#c6e5b5';
  const count = card.tokens.length,
    cols = count <= 1 ? 1 : count <= 4 ? 2 : count <= 9 ? 3 : 4;
  const artWidth = square ? 970 : 510,
    artHeight =
      spec.template === 'stats' ? 300 : square ? (count > 4 ? 620 : 480) : 480,
    cell =
      Math.floor(
        Math.min(
          artWidth / cols,
          artHeight / Math.ceil(Math.max(count, 1) / cols),
        ),
      ) - 8;
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: '#101210',
        color: '#f4f4ed',
        fontFamily: 'sans-serif',
        padding: square ? 48 : 40,
        borderTop: '10px solid ' + accent,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 17,
          color: accent,
          letterSpacing: 2,
        }}
      >
        <span>UGLYDEX /</span>
        <span>{card.eyebrow.slice(0, 85)}</span>
      </div>
      <div
        style={{
          display: 'flex',
          flex: 1,
          flexDirection: square ? 'column' : 'row',
          gap: 24,
          alignItems: 'center',
          marginTop: 22,
        }}
      >
        {count > 0 && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              alignContent: 'center',
              gap: 8,
              width: Math.min(artWidth, cols * (cell + 8)),
              flexShrink: 0,
            }}
          >
            {card.tokens.map((n) => (
              <div
                key={n}
                style={{
                  display: 'flex',
                  position: 'relative',
                  width: cell,
                  height: cell,
                  background: '#242922',
                  border: '1px solid #414b39',
                }}
              >
                {art[n] ? (
                  <img
                    src={art[n]!}
                    width={cell}
                    height={cell}
                    style={{ objectFit: 'contain' }}
                    alt=""
                  />
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '100%',
                      fontSize: Math.max(18, cell / 7),
                      color: accent,
                    }}
                  >
                    SQUIG #{n}
                  </div>
                )}
                <span
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    background: '#101210',
                    color: '#fff',
                    padding: '5px 10px',
                    fontSize: Math.max(14, Math.min(22, cell / 10)),
                  }}
                >
                  #{n}
                </span>
              </div>
            ))}
          </div>
        )}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            ...(square ? { width: '100%' } : {}),
            justifyContent: 'center',
            gap: 12,
          }}
        >
          <div
            style={{
              display: 'flex',
              fontSize: square ? 46 : 48,
              fontWeight: 800,
              lineHeight: 1.08,
            }}
          >
            {card.title.slice(0, 100)}
          </div>
          <div style={{ display: 'flex', fontSize: 22, color: '#c5c8bd' }}>
            {card.description.slice(0, 150)}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {card.stats.slice(0, 6).map((t) => (
              <div
                key={t}
                style={{
                  display: 'flex',
                  fontSize: 22,
                  color: accent,
                  border: '1px solid #46513f',
                  padding: '8px 12px',
                }}
              >
                {t}
              </div>
            ))}
          </div>
          {card.badges.length > 0 && (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                fontSize: 19,
                color: '#e6dac0',
              }}
            >
              {card.badges.join(' · ')}
            </div>
          )}
          {card.date && (
            <div style={{ display: 'flex', fontSize: 18, color: '#b6bbae' }}>
              {new Date(card.date).toISOString().slice(0, 10)}
            </div>
          )}
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 17,
          color: '#9da695',
          marginTop: 16,
        }}
      >
        <span>UGLY LABS / BEAUTIFULLY MALFORMED</span>
        <span>Every Squig has a story.</span>
      </div>
    </div>,
    { width, height },
  );
}

// A corrupt raster must not take down the complete social card.
export async function renderShareSafe(
  card: ShareCard,
  spec: Pick<ShareSpec, 'ratio' | 'template'>,
  art: Record<number, string | null>,
) {
  try {
    return {
      bytes: new Uint8Array(await renderShare(card, spec, art).arrayBuffer()),
      fallback: false,
    };
  } catch {
    return {
      bytes: new Uint8Array(await renderShare(card, spec, {}).arrayBuffer()),
      fallback: true,
    };
  }
}
