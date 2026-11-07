import Link from 'next/link';
import { CollectorCardLink } from './collector-card-link';
import favoriteStyles from './favorite-heart.module.css';
import { StatusIconStrip } from './status-icon-strip';
import { SetIconStrip } from './set-icon-strip';
import { Artwork } from './artwork';
import type { SquigCardData } from '@/server/collections';
import { squigRarityClass } from '@/domain/squig-rarity';
import { AchievementStrip } from './achievement-strip';
import { OpenSeaLink } from './opensea';
import type { OpenSeaListings, SquigListing } from '@/domain/opensea';
export function CompactSquigCard({
  item,
  priority = false,
  compact = false,
  listing,
  marketStatus,
  marketComplete,
  favorite,
  onFavorite,
  savingFavorite = false,
  collectorCard = false,
}: {
  item: SquigCardData;
  priority?: boolean;
  compact?: boolean;
  listing?: SquigListing;
  marketStatus?: OpenSeaListings['status'];
  marketComplete?: boolean;
  favorite?: boolean;
  onFavorite?: () => void;
  savingFavorite?: boolean;
  collectorCard?: boolean;
}) {
  return (
    <article
      className={`${favoriteStyles.card} squig-card ${squigRarityClass(item.rarity)} ${item.currentlyOwned === false ? 'previous' : ''}`}
    >
      {onFavorite ? (
        <button
          type="button"
          className={favoriteStyles.heart}
          aria-pressed={!!favorite}
          aria-label={`${favorite ? 'Remove' : 'Add'} Squig #${item.tokenId} ${favorite ? 'from' : 'to'} favorites`}
          title={favorite ? 'Remove favorite' : 'Add favorite'}
          disabled={savingFavorite}
          onClick={onFavorite}
        >
          <span aria-hidden="true">{favorite ? '♥' : '♡'}</span>
        </button>
      ) : favorite ? (
        <span
          className={favoriteStyles.heart}
          role="img"
          aria-label="Favorite Squig"
        >
          ♥
        </span>
      ) : null}
      <Link className="squig-card-main" href={`/squig/${item.tokenId}`}>
        <Artwork
          src={item.image}
          alt={`Squig #${item.tokenId}`}
          priority={priority}
          sizes={
            compact
              ? '56px'
              : '(max-width: 640px) 45vw, (max-width: 1000px) 30vw, 22vw'
          }
        />
        <div className="card-body">
          {item.representation && (
            <p className="eyebrow">{item.representation}</p>
          )}
          <div className="card-title">
            <h3>
              Squig <span>#{item.tokenId}</span>
            </h3>
            <span className="rarity">{item.rarity ?? 'Unclassified'}</span>
          </div>
          <div className="card-numbers">
            <span>
              <strong>{item.uglyPoints?.toLocaleString() ?? '—'}</strong> UP
            </span>
            <span>Rank {item.mawRank ?? '—'}</span>
          </div>
          <div className="tags">
            {item.og && <span>OG</span>}
            {item.legendary && <span className="legendary">Legendary</span>}
            {item.traits
              .filter(
                (t) =>
                  t.value.trim() && t.value.trim().toLowerCase() !== 'none',
              )
              .slice(0, 3)
              .map((t) => (
                <span key={t.traitType} title={t.traitType}>
                  {t.value}
                </span>
              ))}
          </div>
          {item.achievements && (
            <AchievementStrip summary={item.achievements} subject="SQUIG" />
          )}
          {item.personalization && (
            <p className="ownership-label">
              {item.personalization.owned
                ? 'Currently Owned'
                : item.personalization.discovered
                  ? 'Already Discovered'
                  : 'NEW DISCOVERY'}
              {item.personalization.missingTraits > 0 && (
                <small>
                  Adds {item.personalization.missingTraits} missing traits
                </small>
              )}
              {item.personalization.advances > 0 && (
                <small>Advances {item.personalization.advances} sets</small>
              )}
            </p>
          )}
          {item.currentlyOwned !== undefined && (
            <p className="ownership-label">
              {item.currentlyOwned ? 'Currently Owned' : 'Previously Owned'}
              {item.discoveredAt && (
                <small>
                  Discovered{' '}
                  {new Date(item.discoveredAt).toLocaleDateString('en-US', {
                    timeZone: 'UTC',
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </small>
              )}
            </p>
          )}
          {item.history && (
            <div className="holding-history">
              <small>
                {item.history.firstAcquiredIsChain
                  ? 'First acquired'
                  : 'First confirmed holding'}{' '}
                {new Date(item.history.firstAcquired).toLocaleDateString(
                  'en-US',
                  { timeZone: 'UTC' },
                )}
              </small>
              <small>
                {item.history.lastAcquiredIsChain
                  ? 'Last acquired'
                  : 'Latest confirmed holding'}{' '}
                {new Date(item.history.lastAcquired).toLocaleDateString(
                  'en-US',
                  {
                    timeZone: 'UTC',
                  },
                )}
              </small>
              {item.history.lastLoss && (
                <small>
                  {item.history.lastLossIsChain
                    ? 'Last held until'
                    : 'Evidence valid until'}{' '}
                  {new Date(item.history.lastLoss).toLocaleDateString('en-US', {
                    timeZone: 'UTC',
                  })}
                </small>
              )}
              <small>
                {Math.floor(item.history.heldSeconds / 86400)} indexed days ·{' '}
                {item.history.periods} holding{' '}
                {item.history.periods === 1 ? 'period' : 'periods'}
              </small>
            </div>
          )}
        </div>
      </Link>
      {!!item.statusIcons?.length && (
        <StatusIconStrip icons={item.statusIcons} limit={compact ? 1 : 4} />
      )}
      {!!item.personalization?.sets?.length && (
        <SetIconStrip
          sets={item.personalization.sets}
          limit={compact ? 1 : 4}
          advances
        />
      )}
      {collectorCard && <CollectorCardLink tokenId={item.tokenId} />}
      <OpenSeaLink
        tokenId={item.tokenId}
        listing={listing}
        status={marketStatus}
        complete={marketComplete}
      />
    </article>
  );
}
