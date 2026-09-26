import Link from 'next/link';
import { requireCollector } from '@/server/session';
import { ownedEditions } from '@/server/editions';
import { EditionGrid } from '@/components/editions';
export default async function Page() {
  const items = await ownedEditions(await requireCollector());
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
    </>
  );
}
