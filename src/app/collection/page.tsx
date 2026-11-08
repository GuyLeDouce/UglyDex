import { favoriteTokenIds } from '@/server/favorites';
import { DexNav, DexScore, DiscoveryActions } from '@/components/dex';
import { dexView } from '@/server/dex';
import Link from 'next/link';
import { requireCollector } from '@/server/session';
import { collectionSummary } from '@/server/collections';
import { refreshStatus } from '@/server/refresh';
import { Stats } from '@/components/stats';
import { Refresh } from '@/components/refresh';
import { Catalog, type SearchParams } from '@/components/catalog';
import { CollectionGrid } from '@/components/collection-grid';
export default async function CollectionPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const id = await requireCollector();
  const [summary, status, favorites, view] = await Promise.all([
    collectionSummary(id),
    refreshStatus(),
    favoriteTokenIds(id),
    dexView(id),
  ]);
  return (
    <>
      <section className="page-heading">
        <p className="eyebrow">YOUR LIVING COLLECTION</p>
        <h1>My Collection.</h1>
        <p>
          Every active, verified wallet. One beautifully strange collection.
        </p>
        <a className="button primary" href="#collection-cards">
          Browse my cards ↓
        </a>
        <Link className="text-link" href="/collection/discovered">
          Open your discoveries →
        </Link>
      </section>
      <DiscoveryActions />
      <DexNav />
      <Stats summary={summary} />
      <DexScore view={view} />
      <nav className="anchor-nav" aria-label="Find Squigs for your Dex">
        <Link href="/squigs?dex=advances&sort=sets-desc">
          Advances my UglyDex
        </Link>
        <Link href="/squigs?dex=traits">Missing traits</Link>
        <Link href="/squigs?dex=undiscovered">Undiscovered Squigs</Link>
        <Link href="/squigs">Search all Squigs</Link>
      </nav>
      <Refresh initial={status} />
      <section id="collection-cards" aria-label="Your Squig cards">
        <Catalog
          params={await searchParams}
          collectorId={id}
          viewerId={id}
          path="/collection"
          editableFavorites
        />
      </section>
      <details className="collection-extras">
        <summary>More collection details</summary>
        <section className="section-heading">
          <p className="eyebrow">COLLECTION NOTES</p>
          <h2>What makes yours different.</h2>
        </section>
        <div className="profile-grid">
          <section className="panel">
            <h3>Rarity distribution</h3>
            {summary.rarities.length ? (
              summary.rarities.map((r) => (
                <p key={r.name}>
                  {r.name} <strong>{r.count}</strong>
                </p>
              ))
            ) : (
              <p>No classified Squigs indexed.</p>
            )}
          </section>
          <section className="panel">
            <h3>Recurring traits</h3>
            {summary.traits.length ? (
              summary.traits.map((t) => (
                <p key={`${t.type}:${t.value}`}>
                  {t.value}{' '}
                  <small>
                    {t.type} · {t.count}
                  </small>
                </p>
              ))
            ) : (
              <p>Trait summary appears with your collection.</p>
            )}
          </section>
        </div>
        {summary.top.length > 0 && (
          <>
            <h2>Highest UglyPoints</h2>
            <CollectionGrid
              items={summary.top}
              controls={false}
              favorites={favorites}
              editableFavorites
            />
          </>
        )}
      </details>
    </>
  );
}
