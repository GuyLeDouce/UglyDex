import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { shareSchema, suggestedCopy } from '@/domain/sharing';
import { shareCard, shareMetadata, absoluteUrl } from '@/server/sharing';
import { ShareControls } from '@/components/share-controls';
import { Artwork } from '@/components/artwork';
import { resolveAsset, squigArtwork } from '@/domain/assets';
import { collectibleImageUrl } from '@/domain/collectibles';
import { AchievementBadge } from '@/components/achievement-badge';
import { resolveShareStyle } from '@/domain/share-styles';
type Props = { searchParams: Promise<Record<string, string | undefined>> };
export async function generateMetadata({ searchParams }: Props) {
  const query = await searchParams;
  const p = shareSchema.safeParse(query);
  return p.success
    ? shareMetadata({
        ...p.data,
        template: query.template ? p.data.template : undefined,
      })
    : { title: 'UglyDex', robots: { index: false } };
}
export default async function Page({ searchParams }: Props) {
  const query = await searchParams;
  const q = shareSchema.safeParse(query);
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
        <div className="share-achievement-badges">
          {c.achievementBadges?.map((badge) => (
            <figure key={badge.key}>
              {c.achievementIcons?.find((i) => i.key === badge.key) ? (
                <Image
                  src={
                    c.achievementIcons.find((i) => i.key === badge.key)!.icon
                  }
                  width={48}
                  height={48}
                  alt={badge.name}
                  unoptimized
                />
              ) : (
                <AchievementBadge
                  badge={badge}
                  size={q.data.kind === 'achievement' ? 'showcase' : 'large'}
                  showTooltip
                />
              )}
              <figcaption>{badge.name}</figcaption>
            </figure>
          ))}
        </div>
        <ShareControls
          spec={{
            ...q.data,
            template: resolveShareStyle(
              query.template ? q.data.template : undefined,
              c.appearance?.share,
            ),
          }}
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
