import Link from 'next/link';
import { notFound } from 'next/navigation';
import { galleryView } from '@/server/galleries';
import { currentSession } from '@/server/auth';
import { shareMetadata, absoluteUrl } from '@/server/sharing';
import { ShareControls } from '@/components/share-controls';
import { GalleryArt } from '@/components/gallery';
import { appearanceClass } from '@/domain/cosmetics';
type Props = { params: Promise<{ slug: string; gallerySlug: string }> };
export async function generateMetadata({ params }: Props) {
  const p = await params;
  return shareMetadata({ kind: 'gallery', entity: p.slug, key: p.gallerySlug });
}
export default async function Page({ params }: Props) {
  const p = await params,
    s = await currentSession(),
    g = await galleryView(p.slug, p.gallerySlug, s?.collectorId);
  if (!g) notFound();
  return (
    <div className={appearanceClass(g.appearance)}>
      <section className="gallery-heading">
        <p className="eyebrow">A PRIVATE OBSESSION. A PUBLIC EXHIBITION.</p>
        <h1>{g.name}</h1>
        <p>{g.description}</p>
        <Link href={'/collector/' + p.slug}>
          Curated by {g.collector.name} ↗
        </Link>
        <p className="badge">
          {g.mode === 'CURRENT_COLLECTION'
            ? 'Current collection'
            : 'Discovered history'}{' '}
          · {g.visibility.toLowerCase()}
        </p>
        <ShareControls
          spec={{ kind: 'gallery', entity: p.slug, key: p.gallerySlug }}
          url={absoluteUrl(
            '/collector/' + p.slug + '/gallery/' + p.gallerySlug,
          )}
          copy={g.name + ' — a Squigs Reloaded exhibition.'}
          owner={!g.publicAvailable}
        />
      </section>
      {g.items.length ? (
        <GalleryArt gallery={g} />
      ) : (
        <section className="empty-state">
          No eligible Squigs on display yet. Ownership and confirmed discovery
          determine what can appear here.
        </section>
      )}
    </div>
  );
}
