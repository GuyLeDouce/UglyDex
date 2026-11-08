'use client';
import { CollectorCardLink } from './collector-card-link';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import favoriteStyles from './favorite-heart.module.css';
import { CardDiscovery } from './card-discovery';
import { CollectionViewer } from './collection-viewer';
import { catalogLink, type CatalogContext } from '@/domain/catalog-navigation';
import {
  useEffect,
  useState,
  useSyncExternalStore,
  useTransition,
} from 'react';
import { TradingCardFace } from './trading-card-face';
import { CompactSquigCard } from './compact-squig-card';
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
export function SquigCard(props: Parameters<typeof AlbumSquigCard>[0]) {
  return props.compact ? (
    <CompactSquigCard {...props} />
  ) : (
    <AlbumSquigCard {...props} />
  );
}
function AlbumSquigCard({
  item,
  priority = false,
  listing,
  marketStatus,
  marketComplete,
  favorite,
  onFavorite,
  savingFavorite = false,
  collectorCard = false,
  onOpen,
  viewerOwned,
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
  onOpen?: () => void;
  viewerOwned?: boolean;
}) {
  return (
    <article
      className={`${favoriteStyles.card} squig-card album-card ${squigRarityClass(item.rarity)} ${item.currentlyOwned === false ? 'previous' : ''}`}
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
      <TradingCardFace
        item={item}
        priority={priority}
        href={`/squig/${item.tokenId}`}
        onOpen={onOpen}
      >
        <CardDiscovery item={item} viewerOwned={viewerOwned} />
        <details className="card-details">
          <summary>
            Details {item.currentlyOwned === false ? '· Previously owned' : ''}
          </summary>
          <div className="card-body">
            {onOpen && (
              <Link className="text-link" href={`/squig/${item.tokenId}`}>
                Open Squig Passport →
              </Link>
            )}
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
                    {new Date(item.history.lastLoss).toLocaleDateString(
                      'en-US',
                      {
                        timeZone: 'UTC',
                      },
                    )}
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
        </details>
        {collectorCard && <CollectorCardLink tokenId={item.tokenId} />}
        <OpenSeaLink
          tokenId={item.tokenId}
          listing={listing}
          status={marketStatus}
          complete={marketComplete}
        />
      </TradingCardFace>
    </article>
  );
}
export function CollectionGrid({
  items,
  controls = true,
  favorites: initialFavorites = [],
  editableFavorites = false,
  collectorCardTokens = [],
  catalog,
  viewerSignedIn = false,
}: {
  items: SquigCardData[];
  controls?: boolean;
  favorites?: number[];
  editableFavorites?: boolean;
  collectorCardTokens?: number[];
  catalog?: CatalogContext;
  viewerSignedIn?: boolean;
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
  const savedMode = useSyncExternalStore(subscribe, snapshot, () => 'grid');
  const mode = catalog?.view ?? savedMode;
  const [selected, setSelected] = useState<number | null>(() =>
    catalog?.inspect === 'first'
      ? 0
      : catalog?.inspect === 'last'
        ? items.length - 1
        : null,
  );
  const [turning, startTurning] = useTransition();
  function closeViewer() {
    const token = selected === null ? null : items[selected]?.tokenId;
    setSelected(null);
    if (catalog?.inspect)
      router.replace(catalogLink(catalog.path, catalog.params, {}), {
        scroll: false,
      });
    requestAnimationFrame(() => {
      const button = document.querySelector<HTMLButtonElement>(
        `[data-open-card="${token}"]`,
      );
      button?.focus({ preventScroll: true });
      const album = button?.closest<HTMLElement>('.collection-grid.album');
      const card = button?.closest<HTMLElement>('article');
      if (album && card && album.scrollWidth > album.clientWidth) {
        album.scrollBy({
          left:
            card.getBoundingClientRect().left -
            album.getBoundingClientRect().left -
            8,
          behavior: 'auto',
        });
      }
    });
  }
  function moveCard(delta: number) {
    if (selected === null || turning) return;
    const next = selected + delta;
    if (next >= 0 && next < items.length) {
      setSelected(next);
      return;
    }
    if (
      catalog &&
      catalog.page + delta >= 1 &&
      catalog.page + delta <= catalog.pages
    ) {
      startTurning(() =>
        router.push(
          catalogLink(catalog.path, catalog.params, {
            page: String(catalog.page + delta),
            inspect: delta > 0 ? 'first' : 'last',
          }),
          { scroll: false },
        ),
      );
    }
  }
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
    if (catalog) {
      document.cookie = `${catalog.preferenceKey}=${value}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
      if (value !== 'album') {
        try {
          localStorage.setItem('uglydex-view', value);
          window.dispatchEvent(new Event('storage'));
        } catch {}
      }
      router.push(
        catalogLink(catalog.path, catalog.params, { view: value, page: null }),
        { scroll: false },
      );
      return;
    }
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
          {catalog && (
            <button
              aria-pressed={mode === 'album'}
              onClick={() => setMode('album')}
            >
              ▥ Album
            </button>
          )}
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
      {catalog && (
        <p className="album-page-caption" aria-live="polite">
          {catalog.total
            ? `${(catalog.page - 1) * catalog.pageSize + 1}–${Math.min(catalog.page * catalog.pageSize, catalog.total)} of ${catalog.total.toLocaleString()} Squigs`
            : 'No matching Squigs'}
          {mode === 'album' && (
            <span>Album page {catalog.page} · Tap a card to inspect</span>
          )}
        </p>
      )}
      {catalog && mode === 'album' && catalog.pages > 1 && (
        <nav className="album-turn" aria-label="Album pages">
          {catalog.page > 1 ? (
            <Link
              href={catalogLink(catalog.path, catalog.params, {
                page: String(catalog.page - 1),
              })}
              scroll={false}
            >
              ← Previous page
            </Link>
          ) : (
            <span />
          )}
          <span>
            {catalog.page} / {catalog.pages}
          </span>
          {catalog.page < catalog.pages ? (
            <Link
              href={catalogLink(catalog.path, catalog.params, {
                page: String(catalog.page + 1),
              })}
              scroll={false}
            >
              Next page →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
      {selected !== null && items[selected] && (
        <CollectionViewer
          item={items[selected]}
          position={
            (catalog ? (catalog.page - 1) * catalog.pageSize : 0) + selected + 1
          }
          total={catalog?.total ?? items.length}
          onClose={closeViewer}
          onPrevious={
            selected > 0 || (catalog?.page ?? 1) > 1
              ? () => moveCard(-1)
              : undefined
          }
          onNext={
            selected < items.length - 1 ||
            (catalog && catalog.page < catalog.pages)
              ? () => moveCard(1)
              : undefined
          }
          busy={turning}
          collectorCard={collectorCardTokens.includes(items[selected].tokenId)}
          viewerOwned={
            viewerSignedIn
              ? collectorCardTokens.includes(items[selected].tokenId)
              : undefined
          }
        />
      )}
      {items.length ? (
        <div
          className={`collection-grid ${controls ? mode : 'grid'} ${items.length === 1 ? 'single-card' : ''}`}
        >
          {items.map((item, index) => (
            <SquigCard
              key={item.tokenId}
              item={item}
              viewerOwned={
                viewerSignedIn
                  ? collectorCardTokens.includes(item.tokenId)
                  : undefined
              }
              onOpen={catalog ? () => setSelected(index) : undefined}
              collectorCard={collectorCardTokens.includes(item.tokenId)}
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
