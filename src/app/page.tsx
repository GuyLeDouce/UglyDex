import Link from 'next/link';
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
    <div className="entry-world">
      <section className="entry-copy">
        <p className="eyebrow">A FIELD GUIDE TO THE BEAUTIFULLY MALFORMED</p>
        <h1>
          Every Squig
          <br />
          has a story.
        </h1>
        <p className="entry-lore">
          Watchers from a distant planet. Strangers on the other side of a
          portal. The Squigs have arrived—and every one carries a story. Step
          inside to uncover your collection, its discoveries, and the history
          that makes it yours.
        </p>
        <Link className="button primary" href="/connect">
          Enter UglyDex ↗
        </Link>
        <Link className="entry-explore" href="/squigs">
          Explore the collection
        </Link>
      </section>
      <div
        className="entry-cards landing-specimens"
        aria-label="Real Squigs from the collection"
      >
        {sample.slice(0, 3).map((item, index) => (
          <Link
            key={item.tokenId}
            className={`entry-card entry-card-${index}`}
            href={`/squig/${item.tokenId}`}
          >
            <TradingCardFace item={item} priority={index < 2} />
          </Link>
        ))}
      </div>
    </div>
  );
}
