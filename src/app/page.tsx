import Link from 'next/link';
import { SquigsIcon } from '@/components/squigs-icon';
import { redirect } from 'next/navigation';
import { randomInt } from 'node:crypto';
import { currentSession } from '@/server/auth';
import { db } from '@/server/db';
import {
  cardSelect,
  cardsWithBadges,
  catalogScope,
  type SquigCardData,
} from '@/server/collections';
import { EditorialSection } from '@/components/editorial-section';
import { Artwork } from '@/components/artwork';
import { TradingCardFace } from '@/components/trading-card-face';
export const dynamic = 'force-dynamic';
export default async function Home() {
  if (await currentSession()) redirect('/collection');
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
    <div className="field-home">
      <section className="field-hero">
        <div className="field-hero-copy">
          <p className="eyebrow">UGLY LABS / THE SQUIGS FIELD GUIDE</p>
          <h1>
            Every Squig
            <br />
            has a <em>story.</em>
          </h1>
          <p>
            Watchers from a distant planet. Strangers through a portal. Meet the
            beautifully malformed—and the history they leave behind.
          </p>
          <div className="actions">
            <Link className="button primary" href="/squigs">
              Explore the Squigs <span aria-hidden>↗</span>
            </Link>
            <Link className="text-link" href="/connect">
              Open your field guide
            </Link>
          </div>
        </div>
        <div className="field-hero-art" aria-label="Original Squigs artwork">
          {sample.slice(0, 3).map((item, index) => (
            <Link
              className={`field-specimen field-specimen-${index}`}
              key={item.tokenId}
              href={`/squig/${item.tokenId}`}
            >
              <Artwork
                src={item.image}
                alt={`Squig #${item.tokenId}`}
                priority
                sizes="(max-width: 600px) 45vw, 340px"
              />
              <span>FIELD RECORD / #{item.tokenId}</span>
            </Link>
          ))}
        </div>
      </section>
      <div className="field-masthead">
        <span>4,444 ORIGINAL SQUIGS</span>
        <span>ONE BEAUTIFULLY STRANGE WORLD</span>
        <span>EVERY STORY COUNTS</span>
      </div>
      <EditorialSection
        number="01"
        eyebrow="THE COLLECTION"
        title="Find your kind of ugly."
        href="/squigs"
        link="The complete catalog"
      >
        <p className="editorial-intro">
          A face, a few strange traits, a life of its own. Open a Passport to
          meet the Squig behind the card.
        </p>
        <div className="home-card-shelf">
          {sample.slice(3, 6).map((item) => (
            <TradingCardFace
              key={item.tokenId}
              item={item}
              href={`/squig/${item.tokenId}`}
            />
          ))}
        </div>
      </EditorialSection>
      <EditorialSection
        number="02"
        eyebrow="THE FIELD GUIDE"
        title="Collect more than characters."
      >
        <div className="field-chapters">
          <Link href="/collection/dex">
            <span className="chapter-symbol" aria-hidden>
              <SquigsIcon name="new-discovery" size={40} />
            </span>
            <h3>Follow your discoveries.</h3>
            <p>
              Squigs, traits, and sets. Every discovery adds another page to
              your personal UglyDex.
            </p>
            <span className="chapter-link">Open My UglyDex →</span>
          </Link>
          <Link href="/collectors">
            <span className="chapter-symbol" aria-hidden>
              <SquigsIcon name="recorded-victory" size={40} />
            </span>
            <h3>Meet the collectors.</h3>
            <p>
              Favourite freaks, earned achievements, and field guides built one
              Squig at a time.
            </p>
            <span className="chapter-link">Explore collectors →</span>
          </Link>
          <Link href="/thread">
            <span className="chapter-symbol" aria-hidden>
              <SquigsIcon name="provenance" size={40} />
            </span>
            <h3>Nothing without a story.</h3>
            <p>
              New homes. Hard-earned milestones. Follow the recorded history of
              the ecosystem.
            </p>
            <span className="chapter-link">Read the collector thread →</span>
          </Link>
        </div>
      </EditorialSection>
      <section className="field-invitation">
        <p className="eyebrow">BEAUTIFULLY MALFORMED. ENTIRELY YOURS.</p>
        <h2>
          Your collection.
          <br />
          Your history. Your legacy.
        </h2>
        <div className="actions">
          <Link className="button primary" href="/connect">
            Start your field guide ↗
          </Link>
          <Link className="text-link" href="/editions">
            Discover Squigs Customs
          </Link>
        </div>
      </section>
    </div>
  );
}
