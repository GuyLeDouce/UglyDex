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
      canonical: absoluteUrl('/collector/' + slug + '/achievements'),
    },
  };
}
import { db } from '@/server/db';
import { notFound } from 'next/navigation';
import { TrophyAlbum } from '@/components/trophy-album';
import { trophyAlbum } from '@/server/trophy-album';
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
  const album = await trophyAlbum(c.id, true);
  if (!album) notFound();
  return (
    <>
      <section className="page-heading">
        <p className="eyebrow">COLLECTOR ACHIEVEMENTS</p>
        <h1>{album.name}’s achievement cards.</h1>
        <p>
          Earned achievements and current Set Cards. Sets Achieved remain in
          your Field Guide history.
        </p>
      </section>
      <p>
        {album.level !== null ? `Level ${album.level} · ${album.xp} XP · ` : ''}
        {album.cards.length} available collector cards
      </p>
      <TrophyAlbum {...album} />
    </>
  );
}
