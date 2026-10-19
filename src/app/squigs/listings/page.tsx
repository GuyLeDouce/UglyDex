import Link from 'next/link';
import { Suspense } from 'react';
import { openSeaListings } from '@/server/opensea';
import { OPENSEA_COLLECTION_URL } from '@/domain/opensea';
import { listedSquigPage, type ListedSort } from '@/server/listed-squigs';
import { ListingSortOptions } from '@/components/listing-sort-options';
import { CollectionGrid } from '@/components/collection';
import { currentSession } from '@/server/auth';
import type { FieldGuideFilter } from '@/server/card-personalization';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Squigs listed on OpenSea | UglyDex' };

async function Listings({
  page,
  sort,
  viewerId,
  dex,
}: {
  page: number;
  sort: ListedSort;
  viewerId?: string;
  dex: FieldGuideFilter;
}) {
  const market = await openSeaListings();
  if (market.status === 'unavailable')
    return (
      <section className="empty-state">
        <h2>Listings are temporarily unavailable.</h2>
        <p>
          You can still browse Squigs and check listings directly on OpenSea.
        </p>
      </section>
    );
  const result = await listedSquigPage(market, sort, page, viewerId, dex);
  const { items, pages } = result;
  page = result.page;
  return (
    <>
      {result.personalizationPending && (
        <p role="status">
          Your Field Guide is updating. Missing traits and set progress will
          appear when it is ready.
        </p>
      )}
      <p>
        {result.total} listed Squigs found
        {!market.complete && ' · Partial results'}. Prices and availability can
        change; confirm on OpenSea.
      </p>
      {market.checkedAt && (
        <p className="muted">
          Checked{' '}
          <time dateTime={market.checkedAt}>
            {new Date(market.checkedAt).toLocaleString('en-US', {
              timeZone: 'UTC',
            })}{' '}
            UTC
          </time>
          .
        </p>
      )}
      {items.length ? (
        <CollectionGrid items={items} />
      ) : (
        <section className="empty-state">
          <h2>No listed Squigs to show.</h2>
          <p>Check OpenSea for the latest availability.</p>
        </section>
      )}
      <nav className="pagination" aria-label="Listings pagination">
        {page > 1 ? (
          <Link
            className="button"
            href={`/squigs/listings?sort=${sort}&dex=${dex}&page=${page - 1}`}
          >
            ← Previous
          </Link>
        ) : (
          <span />
        )}
        <span>
          Page {page} of {pages}
        </span>
        {page < pages ? (
          <Link
            className="button"
            href={`/squigs/listings?sort=${sort}&dex=${dex}&page=${page + 1}`}
          >
            Next →
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </>
  );
}
export default async function ListedSquigs({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const session = await currentSession();
  const dex: FieldGuideFilter =
    session &&
    typeof params.dex === 'string' &&
    ['advances', 'traits', 'undiscovered'].includes(params.dex)
      ? (params.dex as FieldGuideFilter)
      : '';
  const value = params.page;
  const sort: ListedSort =
    typeof params.sort === 'string' &&
    ['price-desc', 'points-desc', 'points-asc', 'rank', 'rank-desc'].includes(
      params.sort,
    )
      ? (params.sort as ListedSort)
      : 'price-asc';
  const page =
    typeof value === 'string' && /^\d{1,4}$/.test(value)
      ? Math.max(1, Number(value))
      : 1;
  return (
    <>
      <section className="page-heading">
        <p className="eyebrow">FIND YOUR NEXT SQUIG</p>
        <h1>Listed on OpenSea.</h1>
        <p>Current public asking prices for Squigs Reloaded.</p>
        <div className="actions">
          <Link className="button" href="/squigs">
            All Squigs
          </Link>
          <a
            className="button"
            href={OPENSEA_COLLECTION_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            OpenSea collection ↗
          </a>
        </div>
      </section>
      <form className="filters" action="/squigs/listings">
        <div className="filter-top">
          {session && (
            <label>
              My field guide
              <select name="dex" aria-label="My field guide" defaultValue={dex}>
                <option value="">All listed Squigs</option>
                <option value="advances">Advances My UglyDex</option>
                <option value="traits">Traits I Have Not Discovered</option>
                <option value="undiscovered">Undiscovered Squigs</option>
              </select>
            </label>
          )}
          <label>
            Sort
            <select name="sort" aria-label="Sort" defaultValue={sort}>
              <ListingSortOptions />
              <option value="points-desc">UglyPoints: high to low</option>
              <option value="points-asc">UglyPoints: low to high</option>
              <option value="rank">Maw Rank: low to high</option>
              <option value="rank-desc">Maw Rank: high to low</option>
            </select>
          </label>
          <button className="button primary" type="submit">
            Apply filters
          </button>
        </div>
      </form>
      <Suspense
        key={`${sort}:${page}:${dex}`}
        fallback={<p role="status">Checking OpenSea listings…</p>}
      >
        <Listings
          page={page}
          sort={sort}
          dex={dex}
          viewerId={session?.collectorId}
        />
      </Suspense>
    </>
  );
}
