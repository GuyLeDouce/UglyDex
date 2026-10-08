import Link from 'next/link';
import { db } from '@/server/db';
import { cardSelect, cardDTO, catalogScope } from '@/server/collections';
import { CollectionGrid } from '@/components/collection';
import { Connect } from '@/components/connect';
import { Artwork } from '@/components/artwork';
export const dynamic = 'force-dynamic';
export default async function Home() {
  let sample: ReturnType<typeof cardDTO>[] = [];
  try {
    sample = (
      await db().squig.findMany({
        where: { ...catalogScope, imageUrl: { not: null } },
        select: cardSelect,
        orderBy: { tokenId: 'asc' },
        take: 6,
      })
    ).map(cardDTO);
  } catch {}
  return (
    <div className="landing-world">
      <section className="landing-heading">
        <div className="landing-copy">
          <p className="eyebrow">UGLY LABS / FIELD GUIDE № 001</p>
          <h1>
            Every Squig
            <br />
            has a <em>story.</em>
            <span className="hero-asterisk" aria-hidden>
              ✳
            </span>
          </h1>
          <p className="hero-description">
            4,444 strange little lives. One place to keep their stories.
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
          <h2>Beautifully malformed.</h2>
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
          <p className="eyebrow">MORE THAN A WALLET</p>
          <h2>
            A collection that
            <br />
            remembers.
          </h2>
          <p>
            Bring your wallets together. Find the details that make your Squigs
            yours. Keep a record of the ones that moved on.
          </p>
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
