import { db } from '@/server/db';
import { notFound } from 'next/navigation';
import { Progression } from '@/components/progression';
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params,
    c = await db().collector.findUnique({
      where: { slug },
      select: { id: true, isPublic: true, displayName: true },
    });
  if (!c?.isPublic) notFound();
  return (
    <>
      <section className="page-heading">
        <p className="eyebrow">COLLECTOR ACHIEVEMENTS</p>
        <h1>{c.displayName || slug}</h1>
      </section>
      <Progression
        subject="COLLECTOR"
        id={c.id}
        path={`/collector/${slug}/achievements`}
        public
        full
      />
    </>
  );
}
