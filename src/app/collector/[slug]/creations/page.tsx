import { notFound } from 'next/navigation';
import { db } from '@/server/db';
import { ActivityView } from '@/components/activity';
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
    <ActivityView
      collectorId={c.id}
      public
      path={`/collector/${c.slug}/creations`}
      params={await searchParams}
      gallery
    />
  );
}
