import Link from 'next/link';
import { requireCollector } from '@/server/session';
import { ownedEditions } from '@/server/editions';
import { EditionGrid } from '@/components/editions';
import { collectorEditionHistory } from '@/server/edition-history';
export default async function Page() {
  const collectorId = await requireCollector();
  const [items, history] = await Promise.all([
    ownedEditions(collectorId),
    collectorEditionHistory(collectorId),
  ]);
  return (
    <>
      <h1>Your verified Editions</h1>
      <p>
        Editions are a separate collectible category. Only recent verified
        ownership from linked wallets appears here.
      </p>
      {items.length ? (
        <EditionGrid items={items} />
      ) : (
        <section className="empty-state">
          <p>
            No fresh verified Edition ownership is available. This does not mean
            you own none.
          </p>
          <Link className="button" href="/editions">
            Browse the official catalog and check ownership ↗
          </Link>
        </section>
      )}
      <section>
        <h2>Indexed Edition discoveries</h2>
        <p>
          Historical acquisition requires confirmed identity evidence at the
          event time. Indexed balances are observations at the displayed block,
          separate from Reloaded completion.
        </p>
        {history.map((e) => (
          <p key={e.slug}>
            <Link href={'/editions/' + e.slug}>{e.name}</Link> · {e.quantity} at
            block {e.through} ·{' '}
            {e.fresh && e.complete
              ? 'caught up at last observation'
              : 'incomplete or stale'}{' '}
            · first confirmed acquisition{' '}
            {e.firstAcquired?.slice(0, 10) ?? 'not attributed'}
          </p>
        ))}
        {!history.length && <p>No attributable indexed Edition history yet.</p>}
      </section>
    </>
  );
}
