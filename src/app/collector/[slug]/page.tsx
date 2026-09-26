import { ShareControls } from '@/components/share-controls';
import { absoluteUrl } from '@/server/sharing';
import {
  GalleryShowcase,
  TrophyCase,
  CollectorHighlights,
  CollectorActivityPreview,
} from '@/components/showcase';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { collectorProfile } from '@/server/profiles';
import { type SearchParams } from '@/components/catalog';
import { CollectionGrid } from '@/components/collection';
import { Artwork } from '@/components/artwork';
import { publicCollectorMetadata } from './metadata';
import { appearance } from '@/server/cosmetics';
import { appearanceClass } from '@/domain/cosmetics';
import { ownedEditions } from '@/server/editions';
import { EditionGrid } from '@/components/editions';
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return publicCollectorMetadata((await params).slug);
}
export default async function Collector({
  params,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { slug } = await params,
    r = await collectorProfile(slug);
  if (r.status === 'missing') notFound();
  if (r.status !== 'ready')
    return (
      <section className="empty-state">
        <h1>Profile temporarily unavailable.</h1>
        <p>Please try again shortly.</p>
      </section>
    );
  const p = r.profile;
  const [style, editions] = await Promise.all([
    appearance(r.collectorId),
    ownedEditions(r.collectorId, true),
  ]);
  return (
    <div className={appearanceClass(style)}>
      <section className="page-heading profile-heading">
        <Artwork
          src={p.avatar}
          alt={`${p.displayName || p.slug} avatar`}
          avatar
        />
        <div>
          <p className="eyebrow">COLLECTOR FIELD RECORD</p>
          <h1>{p.displayName || p.slug}</h1>
          <p>@{p.slug}</p>
          <p className="bio">{p.bio}</p>
          {p.wallets.map((w) => (
            <p className="wallet-line" key={w}>
              {w}
            </p>
          ))}
          {p.discord.map((d) => (
            <p key={d}>Discord · {d}</p>
          ))}
        </div>
        <span className="badge">UGLYDEX COLLECTOR</span>
      </section>
      <ShareControls
        spec={{ kind: 'collector', entity: p.slug }}
        url={absoluteUrl('/collector/' + p.slug)}
        copy={(p.displayName || p.slug) + ' — still ugly. Still hunting.'}
      />
      <CollectorHighlights id={r.collectorId} slug={p.slug} />
      {r.featured.length > 0 && (
        <section className="featured-exhibition">
          <p className="eyebrow">PERSONALLY SELECTED</p>
          <h2>The favourite freaks.</h2>
          <CollectionGrid items={r.featured} controls={false} />
        </section>
      )}
      <TrophyCase id={r.collectorId} slug={p.slug} />
      {editions.length > 0 && (
        <section>
          <p className="eyebrow">A DIFFERENT KIND OF COLLECTIBLE</p>
          <h2>Editions · {editions.length} owned</h2>
          <EditionGrid items={editions} />
        </section>
      )}
      <GalleryShowcase id={r.collectorId} slug={p.slug} />
      <CollectorActivityPreview id={r.collectorId} slug={p.slug} />
      {r.collectionVisibility === 'FULL' && (
        <Link className="button" href={'/collector/' + p.slug + '/collection'}>
          Explore the full collection →
        </Link>
      )}
    </div>
  );
}
