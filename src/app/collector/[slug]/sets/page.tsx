import { collectorHandle } from '@/domain/profile';
import { shareMetadata, absoluteUrl } from '@/server/sharing';
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const m = await shareMetadata({ entity: slug, kind: 'collector' });
  return {
    ...m,
    alternates: { canonical: absoluteUrl('/collector/' + slug + '/sets') },
  };
}
import { notFound } from 'next/navigation';
import { publicSetCollector, dexView } from '@/server/dex';
import { DexScore, SetGrid, SetHistory } from '@/components/dex';
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const c = await publicSetCollector((await params).slug);
  if (!c) notFound();
  const view = await dexView(c.id, true);
  return (
    <>
      <section className="page-heading">
        <p className="eyebrow">
          {collectorHandle(c.slug, c.unclaimed)} · COLLECTION FIELD GUIDE
        </p>
        <h1>{c.displayName ?? c.slug}&apos;s strange pursuits.</h1>
      </section>
      <DexScore view={view} />
      {view?.status === 'ready' && (
        <>
          <h2>Featured collections.</h2>
          <SetGrid cards={view.cards.filter((c) => c.featured)} />
          <h2>Current holding sets.</h2>
          <p>
            Set Cards are available while your collection qualifies. Selling a
            required Squig removes the card from your current collection.
          </p>
          <SetGrid
            cards={view.cards.filter((c) => c.mode === 'CURRENT_HOLDING')}
          />
          <h2>Sets Achieved.</h2>
          <p>
            {view.historicalSets} / {view.historicalTotal} visible discovery
            sets achieved. This history contributes to mastery and remains after
            a sale.
          </p>
          <SetHistory
            cards={view.cards.filter(
              (c) => c.mode === 'HISTORICAL_DISCOVERY' && c.complete,
            )}
          />
          <details>
            <summary>Discovery set progress</summary>
            <SetHistory
              cards={view.cards.filter(
                (c) => c.mode === 'HISTORICAL_DISCOVERY' && !c.complete,
              )}
            />
          </details>
          <h2>Previously completed holding sets.</h2>
          <SetHistory
            cards={view.cards.filter(
              (c) =>
                c.mode === 'CURRENT_HOLDING' &&
                !c.complete &&
                c.firstCompletedAt,
            )}
          />
        </>
      )}
    </>
  );
}
