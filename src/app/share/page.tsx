import Link from 'next/link';
import { notFound } from 'next/navigation';
import { shareSchema, suggestedCopy } from '@/domain/sharing';
import { shareCard, shareMetadata, absoluteUrl } from '@/server/sharing';
import { ShareControls } from '@/components/share-controls';
import { Artwork } from '@/components/artwork';
import { resolveAsset, squigArtwork } from '@/domain/assets';
import { collectibleImageUrl } from '@/domain/collectibles';
type Props = { searchParams: Promise<Record<string, string | undefined>> };
export async function generateMetadata({ searchParams }: Props) {
  const p = shareSchema.safeParse(await searchParams);
  return p.success
    ? shareMetadata(p.data)
    : { title: 'UglyDex', robots: { index: false } };
}
export default async function Page({ searchParams }: Props) {
  const q = shareSchema.safeParse(await searchParams);
  if (!q.success) notFound();
  const c = await shareCard(q.data);
  if (!c) notFound();
  return (
    <>
      <section className="gallery-heading">
        <p className="eyebrow">{c.eyebrow}</p>
        <h1>{c.title}</h1>
        <p>{c.description}</p>
        <div className="tags">
          {c.stats.map((s) => (
            <span key={s}>{s}</span>
          ))}
        </div>
        {c.date && <p>{new Date(c.date).toISOString().slice(0, 10)}</p>}
        <ShareControls
          spec={q.data}
          url={absoluteUrl(c.path)}
          copy={suggestedCopy(c)}
        />
      </section>
      <div className="share-art-grid">
        {c.tokens.map((n) => (
          <Link key={n} href={'/squig/' + n}>
            <Artwork
              src={
                c.variants?.[n]
                  ? collectibleImageUrl(c.variants[n].uri)
                  : resolveAsset(squigArtwork(n))
              }
              alt={
                'Squig #' +
                n +
                (c.variants?.[n] ? ' · Official Custom' : ' · Original')
              }
            />
            <span>Squig #{n}</span>
            {c.variants?.[n] && <span className="badge">Official Custom</span>}
          </Link>
        ))}
      </div>
      <div className="tags">
        {c.badges.map((b) => (
          <span key={b}>{b}</span>
        ))}
      </div>
    </>
  );
}
