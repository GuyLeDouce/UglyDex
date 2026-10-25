'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import favoriteStyles from './favorite-heart.module.css';
import { StatusIconStrip } from './status-icon-strip';
import { SetIconStrip } from './set-icon-strip';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Artwork } from './artwork';
import type { SquigCardData } from '@/server/collections';
import { squigRarityClass } from '@/domain/squig-rarity';
import { AchievementStrip } from './achievement-strip';
import { OpenSeaLink, useOpenSeaListings } from './opensea';
import type { OpenSeaListings, SquigListing } from '@/domain/opensea';
const subscribe = (fn: () => void) => {
  window.addEventListener('storage', fn);
  return () => window.removeEventListener('storage', fn);
};
const snapshot = () => {
  try {
    return localStorage.getItem('uglydex-view') === 'compact'
      ? 'compact'
      : 'grid';
  } catch {
    return 'grid';
  }
};
export function SquigCard({
  item,
  priority = false,
  compact = false,
  listing,
  marketStatus,
  marketComplete,
  favorite,
  onFavorite,
  savingFavorite = false,
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
      <OpenSeaLink
        tokenId={item.tokenId}
        listing={listing}
        status={marketStatus}
        complete={marketComplete}
      />
    </article>
  );
}
export function CollectionGrid({
  items,
  controls = true,
  favorites: initialFavorites = [],
  editableFavorites = false,
}: {
  items: SquigCardData[];
  controls?: boolean;
  favorites?: number[];
  editableFavorites?: boolean;
}) {
  const router = useRouter();
  const [favorites, setFavorites] = useState(initialFavorites);
  const [saving, setSaving] = useState(false);
  const [favoriteMessage, setFavoriteMessage] = useState('');
  const favoriteKey = initialFavorites.join(',');
  const [previousFavoriteKey, setPreviousFavoriteKey] = useState(favoriteKey);
  if (previousFavoriteKey !== favoriteKey) {
    setPreviousFavoriteKey(favoriteKey);
    setFavorites(initialFavorites);
  }
  useEffect(() => {
    if (!editableFavorites) return;
    const update = (event: Event) =>
      setFavorites((event as CustomEvent<number[]>).detail);
    window.addEventListener('uglydex-favorites', update);
    return () => window.removeEventListener('uglydex-favorites', update);
  }, [editableFavorites]);
  async function toggleFavorite(tokenId: number) {
    if (saving) return;
    setSaving(true);
    setFavoriteMessage('Saving favorite…');
    try {
      const response = await fetch('/api/settings/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokenId,
          favorite: !favorites.includes(tokenId),
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || 'Could not save favorite.');
      setFavorites(result.favorites);
      window.dispatchEvent(
        new CustomEvent('uglydex-favorites', { detail: result.favorites }),
      );
      setFavoriteMessage(`${result.favorites.length} of 6 favorites selected.`);
      router.refresh();
    } catch (error) {
      setFavoriteMessage(
        error instanceof Error
          ? error.message
          : 'Could not save favorite. Please try again.',
      );
    } finally {
      setSaving(false);
    }
  }
  const mode = useSyncExternalStore(subscribe, snapshot, () => 'grid');
  const market = useOpenSeaListings();
  const listings = new Map(
    market?.listings.map((listing) => [listing.tokenId, listing]),
  );
  const [priorityCount, setPriorityCount] = useState(2);
  useEffect(() => {
    const query = window.matchMedia('(min-width: 561px)');
    const update = () => setPriorityCount(query.matches ? 4 : 2);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  function setMode(value: string) {
    try {
      localStorage.setItem('uglydex-view', value);
      window.dispatchEvent(new Event('storage'));
    } catch {}
  }
  return (
    <>
      {editableFavorites && (
        <p className={favoriteStyles.status} role="status">
          {favoriteMessage ||
            `♥ ${favorites.length} of 6 favorites · Select a heart to feature a Squig.`}
        </p>
      )}
      {controls && (
        <div className="view-controls" aria-label="Collection display">
          <button
            aria-pressed={mode === 'grid'}
            onClick={() => setMode('grid')}
          >
            ▦ Grid
          </button>
          <button
            aria-pressed={mode === 'compact'}
            onClick={() => setMode('compact')}
          >
            ▤ Compact
          </button>
        </div>
      )}
      {items.length ? (
        <div className={`collection-grid ${controls ? mode : 'grid'}`}>
          {items.map((item, index) => (
            <SquigCard
              key={item.tokenId}
              item={item}
              favorite={favorites.includes(item.tokenId)}
              onFavorite={
                editableFavorites && item.currentlyOwned !== false
                  ? () => toggleFavorite(item.tokenId)
                  : undefined
              }
              savingFavorite={saving}
              compact={controls && mode === 'compact'}
              priority={index < priorityCount}
              listing={listings.get(item.tokenId)}
              marketStatus={market?.status}
              marketComplete={market?.complete}
            />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <span aria-hidden>✳</span>
          <h2>No specimens here. Yet.</h2>
          <p>
            No indexed Squigs match this view. Try clearing filters or
            refreshing your collection.
          </p>
        </div>
      )}
    </>
  );
}
