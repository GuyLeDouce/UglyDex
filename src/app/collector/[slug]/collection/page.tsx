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
    alternates: {
      canonical: absoluteUrl('/collector/' + slug + '/collection'),
    },
  };
}
import { notFound } from 'next/navigation';
import { collectorProfile } from '@/server/profiles';
import { Catalog, type SearchParams } from '@/components/catalog';
import { CollectionGrid } from '@/components/collection';
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { slug } = await params,
    r = await collectorProfile(slug);
  if (r.status !== 'ready') notFound();
  return (
    <>
      <h1>{r.profile.displayName || slug}’s collection</h1>
      {r.collectionVisibility === 'FULL' ? (
        <Catalog
          collectorId={r.collectorId}
          params={await searchParams}
          path={'/collector/' + slug + '/collection'}
        />
      ) : r.collectionVisibility === 'FEATURED_ONLY' ? (
        <>
          <p>A personally selected showcase.</p>
          <CollectionGrid items={r.featured} />
        </>
      ) : (
        <p>This collector keeps their collection private.</p>
      )}
    </>
  );
}
