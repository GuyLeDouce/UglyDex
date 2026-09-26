import { DexNav } from '@/components/dex';
import { requireCollector } from '@/server/session';
import { collectionSummary } from '@/server/collections';
import { Catalog, type SearchParams } from '@/components/catalog';
export default async function Discoveries({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const id = await requireCollector(),
    s = await collectionSummary(id);
  return (
    <>
      <DexNav />
      <section className="page-heading">
        <p className="eyebrow">ONCE MET. NEVER FORGOTTEN.</p>
        <h1>Your UglyDex.</h1>
        <p>Squigs leave your wallet. They stay in your story.</p>
        <div className="completion">
          <strong>
            {s.discovered.toLocaleString()}{' '}
            <span>/ 4,444 Squigs Discovered</span>
          </strong>
          <progress
            value={s.discovered}
            max={4444}
            aria-label="Discovery completion"
          />
          <span>{((s.discovered / 4444) * 100).toFixed(2)}% discovered</span>
        </div>
      </section>
      <Catalog
        collectorId={id}
        discovered
        params={await searchParams}
        path="/collection/discovered"
      />
    </>
  );
}
