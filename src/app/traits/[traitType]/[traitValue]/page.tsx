import { notFound } from 'next/navigation';
import Link from 'next/link';
import { traitCatalog } from '@/domain/dex-catalog';
import { decodeTraitSlug } from '@/domain/dex';
import { currentSession } from '@/server/auth';
import { traitView } from '@/server/dex';
import { Catalog, type SearchParams } from '@/components/catalog';
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ traitType: string; traitValue: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { traitType, traitValue } = await params,
    t = traitCatalog.find(
      (t) =>
        t.type === decodeTraitSlug(traitType) &&
        t.value === decodeTraitSlug(traitValue),
    );
  if (!t) notFound();
  const session = await currentSession(),
    data = session ? await traitView(session.collectorId) : null,
    state = data?.traits.find((x) => x.key === t.key),
    p = await searchParams;
  return (
    <>
      <section className="page-heading">
        <p className="eyebrow">CANONICAL TRAIT · {t.type}</p>
        <h1>{t.value}</h1>
        <p>
          {t.count} / 4,444 Squigs · {t.percentage.toFixed(2)}% of the
          collection · {t.ogCount} OGs
        </p>
        {data?.status === 'ready' && (
          <p>
            {state?.owned} currently owned · {state?.discovered} historically
            discovered
            {state?.first && ` · First seen on #${state.first.tokenId}`}
          </p>
        )}
        <Link href="/collection/traits">Open Trait Dex →</Link>
      </section>
      <Catalog
        params={{ ...p, trait: t.type, value: t.value }}
        viewerId={session?.collectorId}
      />
    </>
  );
}
