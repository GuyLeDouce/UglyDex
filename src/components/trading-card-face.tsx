import type { CSSProperties } from 'react';
import type { SquigCardData } from '@/server/collections';
import { tradingCardPalettes } from '@/domain/trading-card-palette';
import { tradingCardData, type CardRarity } from '@/domain/trading-card';
import { squigRarityClass } from '@/domain/squig-rarity';
import { Artwork } from './artwork';

export function TradingCardFace({
  item,
  priority = false,
  heading = true,
}: {
  item: SquigCardData;
  priority?: boolean;
  heading?: boolean;
}) {
  const Heading = heading ? 'h3' : 'span';
  const rarity = squigRarityClass(item.rarity).replace(
    'rarity-',
    '',
  ) as CardRarity;
  const palette = tradingCardPalettes[rarity];
  const card = tradingCardData({
    tokenId: item.tokenId,
    rarityTier: item.rarity,
    legendary: item.legendary,
    og: item.og,
    uglyPoints: item.uglyPoints,
    mawRank: item.mawRank,
    traits: item.traits,
    metadataSourceHash: null,
    metadataUpdatedAt: null,
  });
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
          <Heading className="trading-name">
            Squig <span>#{item.tokenId}</span>
          </Heading>
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
        <p className="trading-type">{card.type}</p>
        {card.legend && <p className="trading-legend">{card.legend}</p>}
        <div className="trading-traits">
          {card.traits.map((t) => (
            <span key={t.traitType}>
              <small>{t.traitType}</small>
              {t.value}
            </span>
          ))}
          {!card.traits.length && !card.legend && (
            <span>Traits not indexed</span>
          )}
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
