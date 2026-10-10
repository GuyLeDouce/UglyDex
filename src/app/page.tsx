import Link from 'next/link';
import Image from 'next/image';
import { randomInt } from 'node:crypto';
import { db } from '@/server/db';
import { cardSelect, cardDTO, catalogScope } from '@/server/collections';
import { CollectionGrid } from '@/components/collection';
import { Connect } from '@/components/connect';
import { Artwork } from '@/components/artwork';
export const dynamic = 'force-dynamic';
export default async function Home() {
  let sample: ReturnType<typeof cardDTO>[] = [];
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
    sample = (
      await db().squig.findMany({
        where: {
          ...where,
          tokenId: { in: tokenIds.slice(0, 6).map(({ tokenId }) => tokenId) },
        },
        select: cardSelect,
        orderBy: { tokenId: 'asc' },
      })
    ).map(cardDTO);
  } catch {}
  return (
    <div className="landing-world">
      <section className="landing-heading">
        <div className="landing-copy">
          <p className="eyebrow">UGLY LABS / FIELD GUIDE № 001</p>
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
            Squigs are strange little creatures, and this is where they keep
            their stories.
          </p>
          <div className="actions">
            <Link className="button primary" href="/connect">
              Connect Wallet ↗
            </Link>
            <Link className="button" href="/squigs">
              Explore Squigs →
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
          <p>Squig artwork appears here after the catalog is imported.</p>
          <Link href="/squigs">Explore the index →</Link>
        </div>
      )}
      <section className="manifesto">
        <div className="manifesto-copy">
          <p className="eyebrow">WELCOME TO THE UGLYDEX</p>
          <h2>Every Squig has a story. Yours is still being written.</h2>
          <p>
            More than a wallet. More than a collection. This is where your Ugly
            legacy comes to life.
          </p>
          <p>
            Every Squig you&apos;ve held, every move you&apos;ve made, every
            milestone you&apos;ve reached, and every achievement still waiting
            to be unlocked.
          </p>
          <p>
            Explore your past, discover your progress, and keep building a
            legacy that&apos;s uniquely yours.
          </p>
          <p>We&apos;ve been watching. Now it&apos;s your turn to see.</p>
          <p className="manifesto-signoff">Stay Ugly. Keep Building.</p>
          <Connect />
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
