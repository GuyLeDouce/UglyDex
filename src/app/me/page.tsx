import { favoriteTokenIds } from '@/server/favorites';
import { collectorHandle } from '@/domain/profile';
import { RecalculateFieldGuide } from '@/components/recalculate-field-guide';
import { appEnvironment } from '@/domain/deployment';
import { DexSummary } from '@/components/dex';
import { CollectorThread } from '@/components/collector-thread';
import { EcosystemSummary } from '@/components/activity';
import { Progression } from '@/components/progression';
import Link from 'next/link';
import { requireCollector } from '@/server/session';
import { db } from '@/server/db';
import {
  cardSelect,
  cardsWithBadges,
  catalogScope,
  collectionSummary,
} from '@/server/collections';
import { refreshStatus } from '@/server/refresh';
import { Stats } from '@/components/stats';
import { Refresh } from '@/components/refresh';
import { CollectionGrid } from '@/components/collection';
import { Artwork } from '@/components/artwork';
import { Timeline } from '@/components/timeline';
import { collectorHistory } from '@/server/provenance';
import { charmBalance, shouldPromptDripLink } from '@/server/drip-sync';
import { CharmBalanceCard } from '@/components/charm-balance';
import { CharmDripLink } from '@/components/charm-drip-link';
export default async function Me() {
  const id = await requireCollector();
  const history = await collectorHistory(id);
  const [charm, promptDripLink] = await Promise.all([
    charmBalance(id),
    shouldPromptDripLink(id),
  ]);
  const [c, s, status] = await Promise.all([
    db().collector.findUniqueOrThrow({
      where: { id },
      include: {
        wallets: {
          where: { status: 'ACTIVE' },
          orderBy: { isPrimary: 'desc' },
        },
        identities: { where: { authenticatedAt: { not: null } } },
        activities: {
          where: { recordStatus: 'ACTIVE' },
          orderBy: { eventAt: 'desc' },
          take: 8,
          select: { id: true, eventAt: true, eventType: true },
        },
      },
    }),
    collectionSummary(id),
    refreshStatus(),
  ]);
  const favorites = await favoriteTokenIds(id);
  const favoriteRows = await db().squig.findMany({
    where: { ...catalogScope, tokenId: { in: favorites } },
    select: cardSelect,
  });
  const favoriteCards = await cardsWithBadges(
    favoriteRows.sort(
      (a, b) => favorites.indexOf(a.tokenId) - favorites.indexOf(b.tokenId),
    ),
  );
  return (
    <div className="collector-dashboard">
      <nav className="anchor-nav">
        <Link href="/settings/galleries">My galleries</Link>
        <Link href="/settings/sharing">Share studio</Link>
      </nav>
      <section className="page-heading profile-heading">
        <Artwork src={c.avatar} alt="Your avatar" avatar />
        <div>
          <p className="eyebrow">PRIVATE FIELD NOTES</p>
          <h1>{c.displayName || 'Your UglyDex'}</h1>
          <p>{collectorHandle(c.slug, false)}</p>
        </div>
        <Link className="button" href="/settings/profile">
          Edit profile ↗
        </Link>
      </section>
      <Stats summary={s} />
      <DexSummary id={id} />
      {appEnvironment() === 'staging' && <RecalculateFieldGuide />}
      <section aria-label="Your favorite Squigs">
        <div className="section-heading inline">
          <h2>Your favorites.</h2>
          <Link href="/collection?favorites=1">View favorites →</Link>
        </div>
        {favoriteCards.length ? (
          <CollectionGrid
            items={favoriteCards}
            controls={false}
            favorites={favorites}
            editableFavorites
          />
        ) : (
          <p>
            Choose up to six currently owned Squigs with the heart in your
            collection.
          </p>
        )}
      </section>
      <Progression subject="COLLECTOR" id={id} path="/me/achievements" />
      <CollectorThread preview />
      {promptDripLink ? <CharmDripLink /> : <CharmBalanceCard value={charm} />}
      <Link href="/charm">Your $CHARM activity →</Link>
      <EcosystemSummary collectorId={id} path="/me/activity" />
      <nav className="anchor-nav">
        <Link href="/me/activity">Activity</Link>
        <Link href="/me/creations">Creations</Link>
      </nav>
      <Refresh initial={status} />
      <div className="section-heading inline">
        <h2>Your standouts.</h2>
        <Link href="/collection">View collection →</Link>
      </div>
      <CollectionGrid
        items={s.top}
        controls={false}
        favorites={favorites}
        editableFavorites
      />
      <section className="passport">
        <p className="eyebrow">YOUR COLLECTION THROUGH TIME</p>
        <h2>Field history.</h2>
        <Timeline entries={history} />
      </section>
      <div className="profile-grid">
        <section className="panel">
          <h2>Connected identities</h2>
          {c.wallets.map((w) => (
            <p className="wallet-line" key={w.id}>
              <span>
                {w.isPrimary ? 'Primary · ' : ''}
                {w.walletAddress}
              </span>
            </p>
          ))}
          {c.identities.map((i) => (
            <p key={i.id}>Discord · {i.username || i.externalId}</p>
          ))}
          <Link href="/settings/wallets">Manage wallets →</Link>
        </section>
        <section className="panel">
          <h2>Recent ecosystem activity</h2>
          {c.activities.length ? (
            c.activities.map((a) => (
              <p key={a.id}>
                {a.eventType.replaceAll('_', ' ')}
                <small>
                  {a.eventAt.toLocaleDateString('en-US', { timeZone: 'UTC' })}
                </small>
              </p>
            ))
          ) : (
            <p>No ecosystem activity imported yet.</p>
          )}
          <Link href="/collection/discovered">
            {s.discovered} discoveries →
          </Link>
        </section>
      </div>
    </div>
  );
}
