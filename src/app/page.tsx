import Link from 'next/link';
import { db } from '@/server/db';
import { cardSelect, cardDTO, catalogScope } from '@/server/collections';
import { CollectionGrid } from '@/components/collection';
import { Connect } from '@/components/connect';
export const dynamic = 'force-dynamic';
export default async function Home() {
  let sample: ReturnType<typeof cardDTO>[] = [];
  try {
    sample = (
      await db().squig.findMany({
        where: { ...catalogScope, imageUrl: { not: null } },
        select: cardSelect,
        orderBy: { tokenId: 'asc' },
        take: 3,
      })
    ).map(cardDTO);
  } catch {}
  return (
    <>
      <section className="landing-heading">
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
          <br />
          Explore Squigs Reloaded, collect your favourites, and remember every
          Squig you’ve discovered.
        </p>
        <div className="actions">
          <Link className="button primary" href="/connect">
            Connect Wallet ↗
          </Link>
          <Link className="button" href="/squigs">
            Explore Squigs →
          </Link>
        </div>
      </section>
      <div className="section-heading inline">
        <div>
          <p className="eyebrow">SPECIMENS FROM THE COLLECTION</p>
          <h2>Beautifully malformed.</h2>
        </div>
        <span className="badge">ETHEREUM · SQUIGS RELOADED</span>
      </div>
      {sample.length ? (
        <CollectionGrid items={sample} controls={false} />
      ) : (
        <div className="empty-state">
          <h2>The field guide is warming up.</h2>
          <p>Squig artwork appears here after the catalog is imported.</p>
          <Link href="/squigs">Explore the index →</Link>
        </div>
      )}
      <section className="manifesto">
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
      </section>
    </>
  );
}
