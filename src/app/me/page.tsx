import { EcosystemSummary } from '@/components/activity';
import Link from 'next/link';
import { requireCollector } from '@/server/session';
import { db } from '@/server/db';
import { collectionSummary } from '@/server/collections';
import { refreshStatus } from '@/server/refresh';
import { Stats } from '@/components/stats';
import { Refresh } from '@/components/refresh';
import { CollectionGrid } from '@/components/collection';
import { Artwork } from '@/components/artwork';
import { Timeline } from '@/components/timeline';
import { collectorHistory } from '@/server/provenance';
export default async function Me() {
  const id = await requireCollector();
  const history = await collectorHistory(id);
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
  return (
    <>
      <section className="page-heading profile-heading">
        <Artwork src={c.avatar} alt="Your avatar" avatar />
        <div>
          <p className="eyebrow">PRIVATE FIELD NOTES</p>
          <h1>{c.displayName || 'Your UglyDex'}</h1>
          <p>@{c.slug}</p>
        </div>
        <Link className="button" href="/settings/profile">
          Edit profile ↗
        </Link>
      </section>
      <Stats summary={s} />
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
      <CollectionGrid items={s.top} controls={false} />
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
    </>
  );
}
