'use client';
import Link from 'next/link';
import { useSyncExternalStore } from 'react';
import { Artwork } from './artwork';
import type { SquigCardData } from '@/server/collections';
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
export function SquigCard({ item }: { item: SquigCardData }) {
  return (
    <Link
      href={`/squig/${item.tokenId}`}
      className={`squig-card ${item.currentlyOwned === false ? 'previous' : ''}`}
    >
      <Artwork src={item.image} alt={`Squig #${item.tokenId}`} />
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
            .filter((t) => t.value && ['Type', 'Skin'].includes(t.traitType))
            .map((t) => (
              <span key={t.traitType}>{t.value}</span>
            ))}
        </div>
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
              {new Date(item.history.lastAcquired).toLocaleDateString('en-US', {
                timeZone: 'UTC',
              })}
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
  );
}
export function CollectionGrid({
  items,
  controls = true,
}: {
  items: SquigCardData[];
  controls?: boolean;
}) {
  const mode = useSyncExternalStore(subscribe, snapshot, () => 'grid');
  function setMode(value: string) {
    try {
      localStorage.setItem('uglydex-view', value);
      window.dispatchEvent(new Event('storage'));
    } catch {}
  }
  return (
    <>
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
          {items.map((item) => (
            <SquigCard key={item.tokenId} item={item} />
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
