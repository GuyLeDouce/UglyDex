import type { CSSProperties } from 'react';
import type { SquigCardData } from '@/server/collections';
import { tradingCardPalettes } from '@/domain/trading-card-palette';
import type { CardRarity } from '@/domain/trading-card';
import { squigRarityClass } from '@/domain/squig-rarity';
import { Artwork } from './artwork';

export function TradingCardFace({
  item,
  priority = false,
}: {
  item: SquigCardData;
  priority?: boolean;
}) {
  const rarity = squigRarityClass(item.rarity).replace(
    'rarity-',
    '',
  ) as CardRarity;
  const palette = tradingCardPalettes[rarity];
  const traits = item.traits
    .filter((t) => t.value.trim() && t.value.toLowerCase() !== 'none')
    .slice(0, 2);
  return (
    <div
      className="trading-face"
      style={
        {
          '--card-light': palette.light,
          '--card-mid': palette.mid,
          '--card-dark': palette.dark,
        } as CSSProperties
      }
    >
      <div className="trading-face-inner">
        <p className="trading-brand">SQUIGS RELOADED</p>
        <div className="trading-title">
          <span className="trading-name">
            Squig <span>#{item.tokenId}</span>
          </span>
          <span className="trading-up">
            <strong>{item.uglyPoints?.toLocaleString() ?? '—'}</strong>
            <small>UGLYPOINTS</small>
          </span>
        </div>
        <Artwork
          src={item.image}
          alt={`Squig #${item.tokenId}`}
          priority={priority}
          sizes="(max-width: 600px) 44vw, (max-width: 1000px) 30vw, 280px"
        />
        <div className="trading-rarity">
          <span>{item.rarity ?? 'Unclassified'}</span>
          <span>
            {item.og ? 'OG · ' : ''}Maw #{item.mawRank ?? '—'}
          </span>
        </div>
        <div className="trading-traits">
          {traits.map((t) => (
            <span key={t.traitType}>
              <small>{t.traitType}</small>
              {t.value}
            </span>
          ))}
        </div>
        <div className="trading-footer">
          <span>
            {item.legendary ? 'LEGENDARY 1/1' : 'EVERY SQUIG HAS A STORY'}
          </span>
          <span>UGLYDEX</span>
        </div>
      </div>
    </div>
  );
}
