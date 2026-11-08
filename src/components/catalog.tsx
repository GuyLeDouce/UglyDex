import { cookies } from 'next/headers';
import { catalogLink, type CatalogContext } from '@/domain/catalog-navigation';
import { favoriteTokenIds } from '@/server/favorites';
import Link from 'next/link';
import { collectionPage } from '@/server/collections';
import { CollectionGrid } from './collection-grid';
import { ListingSortOptions } from './listing-sort-options';
export type SearchParams = Record<string, string | string[] | undefined>;
export async function Catalog({
  params = {},
  collectorId,
  viewerId,
  discovered = false,
  path = '/squigs',
  editableFavorites = false,
}: {
  params?: SearchParams;
  collectorId?: string;
  viewerId?: string;
  discovered?: boolean;
  path?: string;
  editableFavorites?: boolean;
}) {
  const personalAlbum = path === '/collection' && collectorId === viewerId;
  const preferenceKey = personalAlbum
    ? 'uglydex-personal-view'
    : 'uglydex-catalog-view';
  const savedView = (await cookies()).get(preferenceKey)?.value;
  const preferredView =
    savedView && ['album', 'grid', 'compact'].includes(savedView)
      ? savedView
      : undefined;
  params = {
    ...params,
    view: params.view ?? preferredView ?? (personalAlbum ? 'album' : 'grid'),
    sort: params.sort ?? (personalAlbum ? 'favorites' : 'token'),
  };
  const data = await collectionPage(params, collectorId, discovered, viewerId),
    f = data.filters;
  const favorites =
    editableFavorites && collectorId ? await favoriteTokenIds(collectorId) : [];
  const link = (page: number) =>
    catalogLink(path, params, { page: String(page) });
  const activeFilters = [
    ['q', params.q ? `Search: ${params.q}` : ''],
    [
      'dex',
      f.dex
        ? {
            advances: 'Advances my UglyDex',
            traits: 'Missing traits',
            undiscovered: 'New to my Dex',
          }[f.dex]
        : '',
    ],
    ['favorites', f.favorites ? 'My favorites' : ''],
    ['rarity', f.rarity],
    ['og', f.og ? 'OG' : ''],
    ['legendary', f.legendary ? 'Legendary' : ''],
    ['trait', f.trait],
    ['value', f.value],
    ['set', f.set ? `Set: ${f.set}` : ''],
    ['min', f.min !== undefined ? `UP ≥ ${f.min}` : ''],
    ['max', f.max !== undefined ? `UP ≤ ${f.max}` : ''],
  ].filter(([, label]) => label);
  const context: CatalogContext = {
    preferenceKey,
    path,
    params,
    view: f.view,
    page: data.page,
    pages: data.pages,
    pageSize: data.pageSize,
    total: data.total,
    inspect: typeof params.inspect === 'string' ? params.inspect : undefined,
  };
  return (
    <>
      <form
        key={JSON.stringify({ ...f, q: params.q ?? '' })}
        className="filters"
        action={path}
      >
        <input type="hidden" name="view" value={f.view} />
        <div className="filter-top">
          {viewerId && (
            <label>
              My field guide
              <select
                name="dex"
                aria-label="My field guide"
                defaultValue={f.dex}
              >
                <option value="">All Squigs</option>
                <option value="advances">Advances My UglyDex</option>
                <option value="traits">Traits I Have Not Discovered</option>
                <option value="undiscovered">Undiscovered Squigs</option>
              </select>
            </label>
          )}
          {viewerId && (
            <label className="check">
              <input
                type="checkbox"
                name="favorites"
                value="1"
                defaultChecked={!!f.favorites}
              />
              My favorites
            </label>
          )}
          {f.set && <input type="hidden" name="set" value={f.set} />}
          <label>
            Token ID
            <input
              name="q"
              aria-describedby="token-search-help"
              aria-invalid={data.searchError || undefined}
              placeholder="1497, #1497 or paste a Squig link"
              defaultValue={typeof params.q === 'string' ? params.q : f.q}
              maxLength={512}
            />
          </label>
          <label>
            Sort
            <select name="sort" aria-label="Sort" defaultValue={f.sort}>
              {viewerId && <option value="favorites">Favorites first</option>}
              <option value="token">Token ID</option>
              {viewerId && (
                <option value="sets-desc">Most sets advanced</option>
              )}
              <option value="points-desc">UglyPoints ↓</option>
              <option value="points-asc">UglyPoints ↑</option>
              <ListingSortOptions />
              <option value="rank">Maw Rank</option>
              {collectorId && !discovered && (
                <option value="recent">Recently acquired</option>
              )}
              <option value="og">OG first</option>
              <option value="legendary">Legendary first</option>
            </select>
          </label>
          <label>
            Class
            <select name="rarity" defaultValue={f.rarity}>
              <option value="">All classes</option>
              {['common', 'uncommon', 'rare', 'epic', 'legendary'].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <label className="check">
            <input
              type="checkbox"
              name="og"
              value="1"
              defaultChecked={!!f.og}
            />{' '}
            OG
          </label>
          <label className="check">
            <input
              type="checkbox"
              name="legendary"
              value="1"
              defaultChecked={!!f.legendary}
            />{' '}
            Legendary
          </label>
        </div>
        <details
          className="more-filters"
          open={Boolean(f.trait || f.value || f.min || f.max)}
        >
          <summary>Traits & UglyPoints</summary>
          <div className="filter-top">
            <label>
              Trait type
              <select name="trait" defaultValue={f.trait}>
                <option value="">All types</option>
                {[...new Set(data.traits.map((t) => t.traitType))].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label>
              Trait value
              <input
                name="value"
                list="trait-values"
                defaultValue={f.value}
                placeholder="Exact trait value"
              />
              <datalist id="trait-values">
                {[...new Set(data.traits.map((t) => t.value))].map((v) => (
                  <option key={v} value={v} />
                ))}
              </datalist>
            </label>
            <label>
              Minimum UP
              <input name="min" type="number" min="0" defaultValue={f.min} />
            </label>
            <label>
              Maximum UP
              <input name="max" type="number" min="0" defaultValue={f.max} />
            </label>
          </div>
        </details>
        <div className="filter-actions">
          <button className="button primary" type="submit">
            Apply filters
          </button>
          <Link href={catalogLink(path, {}, { view: f.view })}>Clear</Link>
          <span>{data.total.toLocaleString()} Squigs</span>
        </div>
      </form>
      <p id="token-search-help" className="muted">
        Search by token number, #number, UglyDex Passport link or Squigs
        Reloaded OpenSea link.
      </p>
      {data.searchError && (
        <p role="alert">
          That doesn’t look like a Squigs Reloaded token or link. Enter a number
          from 1–4,444, such as #1497.
        </p>
      )}
      {activeFilters.length > 0 && (
        <nav className="active-filters" aria-label="Active filters">
          {activeFilters.map(([key, label]) => (
            <Link
              key={key}
              href={catalogLink(path, params, { [key]: null, page: null })}
              aria-label={`Remove ${label} filter`}
            >
              {label} <span aria-hidden>×</span>
            </Link>
          ))}
          <Link href={catalogLink(path, {}, { view: f.view })}>
            Reset all filters
          </Link>
        </nav>
      )}
      {f.sort === 'sets-desc' && (
        <p className="muted" role="status">
          {data.setSortUnavailable
            ? viewerId
              ? 'Your Field Guide is updating. Showing token ID order until your set progress is ready.'
              : 'Sign in to sort by your set progress. Showing token ID order.'
            : 'Most unfinished sets advanced first, based on your Field Guide. Ties use token ID.'}
        </p>
      )}
      {data.market?.status === 'unavailable' ? (
        <section className="empty-state">
          <h2>Listings are temporarily unavailable.</h2>
          <p>
            Try again shortly or choose another sort option to browse all
            matching Squigs.
          </p>
        </section>
      ) : (
        <>
          {data.market && (
            <p className="muted">
              Showing listed Squigs only
              {!data.market.complete && ' · Partial results'}. Prices and
              availability can change.
            </p>
          )}
          <CollectionGrid
            key={JSON.stringify({ ...params, inspect: undefined })}
            catalog={context}
            items={data.items}
            favorites={favorites}
            editableFavorites={editableFavorites}
          />
        </>
      )}
      {!data.total && (
        <p className="catalog-reset">
          <Link
            className="button"
            href={catalogLink(path, {}, { view: f.view })}
          >
            Reset filters
          </Link>
          {collectorId && (
            <Link
              href={catalogLink('/squigs', params, {
                page: null,
                favorites: null,
              })}
            >
              Search the whole collection →
            </Link>
          )}
        </p>
      )}
      <nav className="pagination" aria-label="Pagination">
        {data.page > 1 ? (
          <Link className="button" href={link(data.page - 1)}>
            ← Previous
          </Link>
        ) : (
          <span />
        )}
        <form action={path} className="page-jump">
          {Object.entries(params)
            .filter(
              ([key, value]) =>
                key !== 'page' &&
                key !== 'inspect' &&
                typeof value === 'string',
            )
            .map(([key, value]) => (
              <input key={key} type="hidden" name={key} value={String(value)} />
            ))}
          <label>
            Page{' '}
            <input
              aria-label="Jump to page"
              name="page"
              type="number"
              min={1}
              max={data.pages}
              defaultValue={data.page}
              key={data.page}
            />
          </label>
          <span>of {data.pages}</span>
          <button className="button" type="submit">
            Go
          </button>
        </form>
        {data.page < data.pages ? (
          <Link className="button" href={link(data.page + 1)}>
            Next →
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </>
  );
}
