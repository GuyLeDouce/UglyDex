import Link from 'next/link';
import { Suspense } from 'react';
import { openSeaListings } from '@/server/opensea';
import {
  OPENSEA_COLLECTION_URL,
  sortedListings,
  type ListingSort,
} from '@/domain/opensea';
import { ListingSortOptions } from '@/components/listing-sort-options';
import { db } from '@/server/db';
import {
  cardsWithBadges,
  cardSelect,
  catalogScope,
} from '@/server/collections';
import { CollectionGrid } from '@/components/collection';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Squigs listed on OpenSea | UglyDex' };

async function Listings({ page, sort }: { page: number; sort: ListingSort }) {
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
  const pages = Math.max(1, Math.ceil(market.listings.length / 24));
  page = Math.min(page, pages);
  const ids = sortedListings(market.listings, sort)
    .slice((page - 1) * 24, page * 24)
    .map((l) => l.tokenId);
  const rows = await db().squig.findMany({
    where: { ...catalogScope, tokenId: { in: ids } },
    select: cardSelect,
  });
  const cards = await cardsWithBadges(rows);
  const byToken = new Map(cards.map((c) => [c.tokenId, c]));
  const items = ids.flatMap((id) => {
    const card = byToken.get(id);
    return card ? [card] : [];
  });
  return (
    <>
      <p>
        {market.listings.length} listed Squigs found
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
            href={`/squigs/listings?sort=${sort}&page=${page - 1}`}
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
            href={`/squigs/listings?sort=${sort}&page=${page + 1}`}
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
  const value = params.page;
  const sort: ListingSort =
    params.sort === 'price-desc' ? 'price-desc' : 'price-asc';
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
          <label>
            Sort
            <select name="sort" defaultValue={sort}>
              <ListingSortOptions />
            </select>
          </label>
          <button className="button primary" type="submit">
            Apply filters
          </button>
        </div>
      </form>
      <Suspense
        key={`${sort}:${page}`}
        fallback={<p role="status">Checking OpenSea listings…</p>}
      >
        <Listings page={page} sort={sort} />
      </Suspense>
    </>
  );
}
