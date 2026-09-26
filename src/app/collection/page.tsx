import { DexNav } from '@/components/dex';
import Link from 'next/link';
import { requireCollector } from '@/server/session';
import { collectionSummary } from '@/server/collections';
import { refreshStatus } from '@/server/refresh';
import { Stats } from '@/components/stats';
import { Refresh } from '@/components/refresh';
import { Catalog, type SearchParams } from '@/components/catalog';
import { CollectionGrid } from '@/components/collection';
export default async function CollectionPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const id = await requireCollector();
  const [summary, status] = await Promise.all([
    collectionSummary(id),
    refreshStatus(),
  ]);
  return (
    <>
      <DexNav />
      <section className="page-heading">
        <p className="eyebrow">YOUR LIVING COLLECTION</p>
        <h1>The usual suspects.</h1>
        <p>
          Every active, verified wallet. One beautifully strange collection.
        </p>
        <Link className="text-link" href="/collection/discovered">
          Open your discoveries →
        </Link>
      </section>
      <Stats summary={summary} />
      <Refresh initial={status} />
      <Catalog
        params={await searchParams}
        collectorId={id}
        path="/collection"
      />
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
          <CollectionGrid items={summary.top} controls={false} />
        </>
      )}
    </>
  );
}
