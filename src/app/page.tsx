import Link from 'next/link';
import { CollectorThread } from '@/components/collector-thread';
import { UglyUsers } from '@/components/ugly-users';
import Image from 'next/image';
import { randomInt } from 'node:crypto';
import { db } from '@/server/db';
import {
  cardSelect,
  cardsWithBadges,
  catalogScope,
  type SquigCardData,
} from '@/server/collections';
import { CollectionGrid } from '@/components/collection';
import { Artwork } from '@/components/artwork';
export const dynamic = 'force-dynamic';
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { usersPage } = await searchParams;
  const page =
    typeof usersPage === 'string' && /^\d{1,6}$/.test(usersPage)
      ? Number(usersPage)
      : 1;
  let sample: SquigCardData[] = [];
  try {
    const where = { ...catalogScope, imageUrl: { not: null } };
    const tokenIds = await db().squig.findMany({
      where,
      select: { tokenId: true },
      orderBy: { tokenId: 'asc' },
    });
    for (let index = tokenIds.length - 1; index > 0; index -= 1) {
      const swapIndex = randomInt(index + 1);
      [tokenIds[index], tokenIds[swapIndex]] = [
        tokenIds[swapIndex],
        tokenIds[index],
      ];
    }
    sample = await cardsWithBadges(
      await db().squig.findMany({
        where: {
          ...where,
          tokenId: { in: tokenIds.slice(0, 6).map(({ tokenId }) => tokenId) },
        },
        select: cardSelect,
        orderBy: { tokenId: 'asc' },
      }),
    );
  } catch {}
  return (
    <div className="landing-world">
      <section className="landing-heading">
        <div className="landing-copy">
          <p className="eyebrow">WELCOME TO UGLYDEX</p>
          <h1 className="landing-headline-image-wrap">
            <Image
              className="landing-headline-image"
              src="https://i.imgur.com/vxZhj8L.png"
              alt="Every Squig has a story."
              fill
              sizes="(max-width: 560px) 100vw, 60vw"
              unoptimized
            />
          </h1>
          <p className="hero-description">
            Meet the Squigs, discover their stories, and see what the community
            has been up to. Take a look around—you don&apos;t need an account to
            explore.
          </p>
          <div className="actions">
            <Link className="button primary" href="/squigs">
              Explore Squigs →
            </Link>
            <Link className="button" href="/thread">
              Meet the community →
            </Link>
          </div>
        </div>
        {sample.length > 0 && (
          <div
            className="landing-specimens"
            aria-label="Real Squigs from the collection"
          >
            {sample.slice(0, 3).map((s, index) => (
              <Link
                className={`landing-specimen specimen-${index + 1}`}
                href={`/squig/${s.tokenId}`}
                key={s.tokenId}
              >
                <Artwork
                  src={s.image}
                  alt={`Squig #${s.tokenId}`}
                  priority={index < 2}
                />
                <span>Squig #{s.tokenId}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
      <div className="section-heading inline landing-section-heading">
        <div>
          <p className="eyebrow">SPECIMENS FROM THE COLLECTION</p>
        </div>
        <span className="badge">ETHEREUM · SQUIGS RELOADED</span>
      </div>
      {sample.length > 3 ? (
        <CollectionGrid items={sample.slice(3, 6)} controls={false} />
      ) : sample.length ? (
        <CollectionGrid items={sample} controls={false} />
      ) : (
        <div className="empty-state">
          <h2>The field guide is warming up.</h2>
          <p>
            The collection is taking a moment to load. You can still visit the
            index.
          </p>
          <Link href="/squigs">Explore the index →</Link>
        </div>
      )}
      <CollectorThread preview />
      <UglyUsers page={page} />
      <section className="manifesto">
        <div className="manifesto-copy">
          <p className="eyebrow">MAKE YOURSELF AT HOME</p>
          <h2>A little strange. A lot to discover.</h2>
          <p>
            Start with a Squig that catches your eye. Open its Passport to
            explore its traits and recorded history, or drop into the Collector
            Thread to see what&apos;s happening across the community.
          </p>
          <p>
            Have Squigs of your own? When you&apos;re ready, sign in to bring
            your verified collection, favorites, and Field Guide progress
            together.
          </p>
          <p className="manifesto-signoff">Stay curious. Stay Ugly.</p>
          <Link className="text-link" href="/connect">
            Sign in to your UglyDex →
          </Link>
        </div>
        {sample[0] && (
          <Link
            className="manifesto-specimen"
            href={`/squig/${sample[0].tokenId}`}
          >
            <Artwork
              src={sample[0].image}
              alt={`Squig #${sample[0].tokenId}`}
            />
            <span>STILL HERE. STILL UGLY.</span>
          </Link>
        )}
      </section>
    </div>
  );
}
