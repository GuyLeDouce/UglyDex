import Link from 'next/link';
import { requireCollector } from '@/server/session';
import { db } from '@/server/db';
import { GalleryEditor } from '@/components/gallery-editor';
import { eligibleGalleryTokens } from '@/server/galleries';
export default async function Galleries({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const id = await requireCollector(),
    q = await searchParams;
  const rows = await db().collectorGallery.findMany({
    where: { collectorId: id },
    orderBy: { createdAt: 'asc' },
    include: {
      items: {
        orderBy: { sortOrder: 'asc' },
        include: {
          squig: { select: { tokenId: true } },
          custom: { select: { key: true } },
        },
      },
    },
  });
  const collector = await db().collector.findUniqueOrThrow({
    where: { id },
    select: { slug: true },
  });
  const selected = rows.find((g) => g.id === q.edit);
  const eligible = await eligibleGalleryTokens(id, 'CURRENT_COLLECTION');
  const customs = await db().squigCustom.findMany({
    where: { status: 'VERIFIED', squig: { tokenId: { in: eligible.current } } },
    select: { key: true, name: true, squig: { select: { tokenId: true } } },
  });
  return (
    <>
      <section className="page-heading">
        <p className="eyebrow">YOUR OWN STRANGE LITTLE EXHIBITION</p>
        <h1>Put your freaks on display.</h1>
        <p>Galleries start private. Publish only what you want to share.</p>
        <Link href="/settings/sharing">Open share studio ↗</Link>
      </section>
      <nav className="anchor-nav">
        <Link href="/settings/galleries">New gallery</Link>
        {rows.map((g) => (
          <Link key={g.id} href={'?edit=' + g.id}>
            {g.name} · {g.visibility.toLowerCase()}
          </Link>
        ))}
      </nav>
      {!rows.length && (
        <p>
          You haven’t built a gallery yet. Pick your favourite freaks and put
          them on display.
        </p>
      )}
      {selected && (
        <Link
          className="button"
          href={'/collector/' + collector.slug + '/gallery/' + selected.slug}
        >
          Preview gallery ↗
        </Link>
      )}
      <GalleryEditor
        customs={customs.map((c) => ({
          key: c.key,
          name: c.name,
          tokenId: c.squig.tokenId,
        }))}
        key={selected?.id + '-' + selected?.revision}
        initial={
          selected
            ? {
                id: selected.id,
                revision: selected.revision,
                slug: selected.slug,
                name: selected.name,
                description: selected.description,
                visibility: selected.visibility,
                mode: selected.mode,
                layout: selected.layout,
                coverTokenId: selected.coverTokenId,
                featured: selected.featured,
                items: selected.items.map((i) => ({
                  tokenId: i.squig.tokenId,
                  caption: i.caption,
                  section: i.section,
                  customKey: i.custom?.key ?? null,
                })),
              }
            : undefined
        }
      />
    </>
  );
}
