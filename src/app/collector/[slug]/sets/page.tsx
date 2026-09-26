import { notFound } from 'next/navigation';
import { publicSetCollector, dexView } from '@/server/dex';
import { DexScore, SetGrid } from '@/components/dex';
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
        <p className="eyebrow">@{c.slug} · COLLECTION FIELD GUIDE</p>
        <h1>{c.displayName ?? c.slug}&apos;s strange pursuits.</h1>
      </section>
      <DexScore view={view} />
      {view?.status === 'ready' && (
        <>
          <h2>Featured collections.</h2>
          <SetGrid cards={view.cards.filter((c) => c.featured)} />
          <h2>Historical discoveries.</h2>
          <SetGrid
            cards={view.cards.filter((c) => c.mode === 'HISTORICAL_DISCOVERY')}
          />
          <h2>Current collections.</h2>
          <SetGrid
            cards={view.cards.filter((c) => c.mode === 'CURRENT_HOLDING')}
          />
        </>
      )}
    </>
  );
}
