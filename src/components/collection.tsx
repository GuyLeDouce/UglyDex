'use client';
import { Artwork } from './artwork';
import { squigArtwork } from '@/domain/assets';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import favoriteStyles from './favorite-heart.module.css';
import { StatusIconStrip } from './status-icon-strip';
import { SetIconStrip } from './set-icon-strip';
import { CollectionViewer } from './collection-viewer';
import {
  catalogLink,
  savedCollectionView,
  type CatalogContext,
} from '@/domain/catalog-navigation';
import {
  useEffect,
  useState,
  useSyncExternalStore,
  useTransition,
} from 'react';
import { TradingCardFace } from './trading-card-face';
import { CompactSquigCard } from './compact-squig-card';
import type { SquigCardData } from '@/server/collections';
import { tradingCardPalettes } from '@/domain/trading-card-palette';
import { squigRarity, squigRarityClass } from '@/domain/squig-rarity';
import { AchievementBadge } from './achievement-badge';
import { useOpenSeaListings } from './opensea';
const subscribe = (fn: () => void) => {
  window.addEventListener('storage', fn);
  return () => window.removeEventListener('storage', fn);
};
const snapshot = () => {
  try {
    return savedCollectionView(localStorage.getItem('uglydex-view'));
  } catch {
    return 'album';
  }
};
type SquigCardProps = Parameters<typeof CompactSquigCard>[0] & {
  onOpen?: () => void;
};
export function SquigCard(props: SquigCardProps) {
  return props.compact ? (
    <CompactSquigCard {...props} />
  ) : (
    <AlbumSquigCard {...props} />
  );
}
function AlbumBadges({ item }: { item: SquigCardData }) {
  const [expanded, setExpanded] = useState(false);
  // The server orders earned Squig badges by rarity, then catalog order.
  const badges = item.achievements?.badges;
  if (!badges?.length) return null;
  return (
    <div className="album-badges">
      {(expanded ? badges : badges.slice(0, 4)).map((badge) => (
        <AchievementBadge key={badge.key} badge={badge} size="small" />
      ))}
      {badges.length > 4 && (
        <button
          type="button"
          aria-expanded={expanded}
          aria-label={
            expanded
              ? `Show fewer badges for Squig #${item.tokenId}`
              : `Show all ${badges.length} badges for Squig #${item.tokenId}`
          }
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? '−' : '+'}
        </button>
      )}
    </div>
  );
}
function AlbumSquigCard({
  item,
  priority = false,
  favorite,
  onFavorite,
  savingFavorite = false,
  onOpen,
}: SquigCardProps) {
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
      />
      <div className="album-card-icons">
        {!!item.statusIcons?.length && (
          <StatusIconStrip icons={item.statusIcons} />
        )}
        {!!item.personalization?.sets?.length && (
          <SetIconStrip sets={item.personalization.sets} advances />
        )}
        <AlbumBadges item={item} />
      </div>
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
  const savedMode = useSyncExternalStore(subscribe, snapshot, () => 'album');
  const [pendingMode, setPendingMode] = useState<CatalogContext['view'] | null>(
    null,
  );
  const mode = catalog ? (pendingMode ?? catalog.view) : savedMode;
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
  function setMode(value: CatalogContext['view']) {
    const preference = value === 'grid' ? 'art-grid' : value;
    try {
      localStorage.setItem('uglydex-view', preference);
      window.dispatchEvent(new Event('storage'));
    } catch {}
    if (catalog) {
      setSelected(null);
      setPendingMode(value);
      document.cookie = `${catalog.preferenceKey}=${preference}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
      router.push(
        catalogLink(catalog.path, catalog.params, { view: value, page: null }),
        { scroll: false },
      );
    }
  }
  return (
    <>
      {editableFavorites && mode !== 'grid' && (
        <p className={favoriteStyles.status} role="status">
          {favoriteMessage ||
            `♥ ${favorites.length} of 6 favorites · Select a heart to feature a Squig.`}
        </p>
      )}
      {controls && (
        <div className="view-controls" aria-label="Collection display">
          <button
            aria-pressed={mode === 'album'}
            onClick={() => setMode('album')}
          >
            ▥ Album
          </button>
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
          className={`collection-grid ${controls ? mode : 'album'} ${items.length === 1 ? 'single-card' : ''}`}
        >
          {items.map((item, index) =>
            controls && mode === 'grid' ? (
              <button
                className="art-tile"
                style={{
                  borderColor:
                    tradingCardPalettes[squigRarity(item.rarity)].mid,
                }}
                type="button"
                key={item.tokenId}
                data-open-card={item.tokenId}
                aria-label={`View Squig #${item.tokenId}, ${squigRarity(item.rarity)} rarity`}
                onClick={() => setSelected(index)}
              >
                <Artwork
                  src={squigArtwork(item.tokenId)}
                  alt={`Squig #${item.tokenId}`}
                  priority={index < priorityCount}
                  sizes="(max-width:600px) 25vw, 140px"
                />
              </button>
            ) : (
              <SquigCard
                key={item.tokenId}
                item={item}
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
            ),
          )}
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
