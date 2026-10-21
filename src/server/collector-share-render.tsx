/* eslint-disable @next/next/no-img-element -- ImageResponse primitives. */
import 'server-only';
import { ImageResponse } from 'next/og';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ShareCard, ShareSpec } from '@/domain/sharing';
import { achievementBadgeFile } from './achievement-badge-assets';
import { shareBackground } from './share-backgrounds';
const png = (file: string) =>
  'data:image/png;base64,' + readFileSync(file).toString('base64');
export function renderCollectorShare(
  card: ShareCard,
  spec: Pick<ShareSpec, 'ratio' | 'template'>,
  art: Record<number, string | null>,
) {
  const layout = card.collectorLayout!;
  const square = spec.ratio === 'square',
    width = square ? 1080 : 1200,
    height = square ? 1080 : 630;
  const side = square ? 230 : 250,
    center = square ? 440 : 540;
  const badges = (card.achievementBadges ?? [])
    .filter((b) => b.status === 'earned')
    .slice(0, 12);
  const title = card.title.slice(0, 60);
  return new ImageResponse(
    <div
      style={{
        display: 'flex',
        position: 'relative',
        width: '100%',
        height: '100%',
        background: '#171e28',
        color: '#fff5dd',
        fontFamily: 'sans-serif',
        padding: 32,
        flexDirection: 'column',
      }}
    >
      <img
        src={shareBackground(spec.template)}
        width={width}
        height={height}
        alt=""
        style={{ position: 'absolute', top: 0, left: 0, objectFit: 'cover' }}
      />
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          height: 76,
          alignItems: 'center',
        }}
      >
        <div
          style={{
            display: 'flex',
            padding: '10px 24px',
            borderRadius: 18,
            background: '#111820',
            fontSize: title.length > 30 ? 28 : 40,
            maxWidth: center + 80,
          }}
        >
          {title}
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          flex: 1,
          gap: 16,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: side,
            padding: 14,
            borderRadius: 18,
            background: 'rgba(17,24,32,0.88)',
          }}
        >
          <div style={{ display: 'flex', fontSize: 18, marginBottom: 18 }}>
            ACHIEVEMENTS
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {badges.map((b) => {
              const file = achievementBadgeFile(b.key);
              return (
                <div
                  key={b.key}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    width: (side - 48) / 3,
                    marginBottom: 8,
                  }}
                >
                  {file && (
                    <img
                      src={png(file)}
                      width={square ? 56 : 52}
                      height={square ? 56 : 52}
                      alt={b.name}
                      style={{ objectFit: 'contain' }}
                    />
                  )}
                  <div
                    style={{
                      display: 'flex',
                      fontSize: 12,
                      textAlign: 'center',
                      height: 32,
                      overflow: 'hidden',
                    }}
                  >
                    {b.name}
                  </div>
                </div>
              );
            })}
          </div>
          {!badges.length && (
            <div style={{ display: 'flex', fontSize: 16 }}>
              Your next achievement awaits.
            </div>
          )}
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: center,
            gap: 18,
          }}
        >
          <div
            style={{
              display: 'flex',
              width: square ? 240 : 180,
              height: square ? 240 : 180,
              borderRadius: 999,
              overflow: 'hidden',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#c9d0d8',
              color: '#18202c',
              fontSize: 70,
              border: '4px solid #fff5dd',
            }}
          >
            {art[0] ? (
              <img
                src={art[0]}
                width={square ? 240 : 180}
                height={square ? 240 : 180}
                alt="Collector profile"
                style={{ objectFit: 'cover' }}
              />
            ) : (
              title.slice(0, 2).toUpperCase()
            )}
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              width: '100%',
              padding: 14,
              borderRadius: 18,
              background: 'rgba(17,24,32,0.88)',
              flex: 1,
            }}
          >
            <div style={{ display: 'flex', fontSize: 18, marginBottom: 12 }}>
              FAVOURITE SQUIGS
            </div>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 10,
                justifyContent: 'center',
              }}
            >
              {card.tokens.slice(0, 6).map((n) => (
                <div
                  key={n}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    width: (center - 48) / 3,
                  }}
                >
                  {art[n] ? (
                    <img
                      src={art[n]!}
                      width={square ? 112 : 76}
                      height={square ? 112 : 76}
                      alt={`Squig #${n}`}
                      style={{ borderRadius: 8, objectFit: 'contain' }}
                    />
                  ) : (
                    <div
                      style={{
                        display: 'flex',
                        width: square ? 112 : 76,
                        height: square ? 112 : 76,
                        background: '#303a47',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      #{n}
                    </div>
                  )}
                  <div style={{ display: 'flex', fontSize: 12, marginTop: 3 }}>
                    #{n}
                  </div>
                </div>
              ))}
            </div>
            {!card.tokens.length && (
              <div style={{ display: 'flex', fontSize: 16 }}>
                No public favourites selected.
              </div>
            )}
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: side,
            gap: 12,
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              padding: 14,
              background: '#111820',
              borderRadius: 18,
              alignItems: 'center',
            }}
          >
            <div style={{ display: 'flex', fontSize: 20 }}>
              LEVEL {layout.level ?? '—'}
            </div>
            <div style={{ display: 'flex', fontSize: 38 }}>
              {layout.completion === null ? '—' : layout.completion.toFixed(1)}%
            </div>
            <div style={{ display: 'flex', fontSize: 18 }}>
              {layout.squigs} Squigs held
            </div>
            <div style={{ display: 'flex', fontSize: 18 }}>
              {layout.discovered ?? '—'} Squigs discovered
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              padding: 14,
              borderRadius: 18,
              background: 'rgba(17,24,32,0.88)',
            }}
          >
            <div style={{ display: 'flex', fontSize: 18, marginBottom: 16 }}>
              COMPLETED SETS
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {layout.sets.slice(0, 6).map((s) => (
                <div
                  key={s.key}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    width: (side - 48) / 3,
                    marginBottom: square ? 6 : 0,
                  }}
                >
                  <img
                    src={png(join(process.cwd(), 'public', s.icon))}
                    width={48}
                    height={48}
                    alt={s.name}
                  />
                  <div
                    style={{
                      display: 'flex',
                      fontSize: square ? 12 : 10,
                      lineHeight: 1,
                      textAlign: 'center',
                      height: 32,
                      overflow: 'hidden',
                    }}
                  >
                    {s.name}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', fontSize: 14, marginTop: 12 }}>
        UGLYDEX · Every Squig has a story.
      </div>
    </div>,
    { width, height },
  );
}
