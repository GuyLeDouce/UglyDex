import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';
import type { SquigCardData } from '@/server/collections';
import {
  tradingCardPalettes,
  TRADING_BAR_INK,
} from '@/domain/trading-card-palette';
import { tradingCardData, type CardRarity } from '@/domain/trading-card';
import { squigRarityClass } from '@/domain/squig-rarity';
import { Artwork } from './artwork';

export function TradingCardFace({
  item,
  priority = false,
  heading = true,
  href,
  children,
  onOpen,
}: {
  item: SquigCardData;
  priority?: boolean;
  heading?: boolean;
  href?: string;
  children?: ReactNode;
  onOpen?: () => void;
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
  const face = (
    <>
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
        sizes="(max-width: 600px) 90vw, (max-width: 1000px) 45vw, 360px"
      />
      <div className="trading-identity">
        <span className="trading-type">
          {card.legendary ? 'Legendary 1/1' : card.type}
        </span>
        {card.og && <span className="trading-og">OG</span>}
        <span className="trading-rarity">
          ◇ {item.rarity ?? 'Unclassified'}
        </span>
      </div>
      <div className="trading-rank">
        <span>Maw rank</span>
        <strong>#{card.mawRank ?? '—'}</strong>
        {card.legendary && card.mawRank === 1 && <small>Shared</small>}
      </div>
      {card.legend && (
        <div className="trading-legend">
          <small>One of a kind</small>
          <strong>{card.legend}</strong>
        </div>
      )}
      <div className="trading-traits">
        {card.traits.map((t) => (
          <span key={t.traitType}>
            <small>{t.traitType}</small>
            {t.value}
          </span>
        ))}
        {!card.traits.length && !card.legend && <span>Traits not indexed</span>}
      </div>
    </>
  );
  return (
    <div
      className="trading-face"
      data-finish={rarity}
      data-og={card.og || undefined}
      style={
        {
          '--card-light': palette.light,
          '--card-mid': palette.mid,
          '--card-dark': palette.dark,
          '--card-bar': palette.bar,
          '--card-ink': TRADING_BAR_INK,
        } as CSSProperties
      }
    >
      <div className="trading-face-inner">
        {onOpen ? (
          <button
            type="button"
            className="squig-card-main card-open"
            data-open-card={item.tokenId}
            aria-label={`View Squig #${item.tokenId} card`}
            onClick={onOpen}
          >
            {face}
          </button>
        ) : href ? (
          <Link className="squig-card-main" href={href}>
            {face}
          </Link>
        ) : (
          face
        )}
        {children}
        <div className="trading-footer">
          <strong>UGLY LABS</strong>
          <span>UGLYDEX · #{item.tokenId}</span>
        </div>
      </div>
    </div>
  );
}
