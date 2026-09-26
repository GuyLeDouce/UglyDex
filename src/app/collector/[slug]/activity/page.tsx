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
    alternates: { canonical: absoluteUrl('/collector/' + slug + '/activity') },
  };
}
import { notFound } from 'next/navigation';
import { db } from '@/server/db';
import { ActivityView, EcosystemSummary } from '@/components/activity';
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const c = await db().collector.findFirst({
    where: { slug, isPublic: true },
    select: { id: true, slug: true },
  });
  if (!c) notFound();
  return (
    <>
      <EcosystemSummary
        collectorId={c.id}
        public
        path={`/collector/${c.slug}/activity`}
      />
      <ActivityView
        collectorId={c.id}
        public
        path={`/collector/${c.slug}/activity`}
        params={await searchParams}
      />
    </>
  );
}
