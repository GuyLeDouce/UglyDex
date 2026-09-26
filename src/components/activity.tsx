import Link from 'next/link';
import { Timeline } from './timeline';
import { Artwork } from './artwork';
import { categories, formatAmount } from '@/domain/activity';
import {
  activityPage,
  ecosystemSummary,
  historyFreshness,
  creationPage,
} from '@/server/activity';
export async function EcosystemSummary({
  collectorId,
  squigId,
  public: publicView = false,
  path,
}: {
  collectorId?: string;
  squigId?: string;
  public?: boolean;
  path: string;
}) {
  const s = await ecosystemSummary({
    collectorId,
    squigId,
    public: publicView,
  });
  if (!s.categories.length && !s.charm.length && !s.creator.submitted)
    return null;
  return (
    <section className="passport">
      <div className="section-heading inline">
        <div>
          <p className="eyebrow">TRACKED UGLYDEX HISTORY</p>
          <h2>A life in the ecosystem.</h2>
        </div>
        <Link href={path}>Explore activity →</Link>
      </div>
      <div className="ecosystem-cards">
        {s.duels.played > 0 && (
          <div className="panel">
            <h3>Duels</h3>
            <strong>{s.duels.played} completed</strong>
            <p>
              {s.duels.wins} wins · {s.duels.losses} losses
            </p>
            <small>
              {s.mostUsed ? `Most used: #${s.mostUsed.tokenId} · ` : ''}
              {s.duels.uniqueSquigs} Squigs used · largest wager{' '}
              {s.duels.largest ? formatAmount(s.duels.largest) : 'unavailable'}
            </small>
          </div>
        )}
        {s.survival.games > 0 && (
          <div className="panel">
            <h3>Survival</h3>
            <strong>{s.survival.games} recorded games</strong>
            <p>
              {s.survival.firsts} first · {s.survival.seconds} second ·{' '}
              {s.survival.thirds} third
            </p>
            <small>
              {s.survival.eliminations} eliminations · {s.survival.deaths}{' '}
              deaths · {s.survival.images} images used
            </small>
          </div>
        )}
        {s.marketplace.purchases > 0 && (
          <div className="panel">
            <h3>Marketplace</h3>
            <strong>{s.marketplace.purchases} purchases</strong>
            <p>
              {s.marketplace.items} items · {formatAmount(s.marketplace.spent)}{' '}
              $CHARM spent
            </p>
          </div>
        )}
        {s.creator.submitted > 0 && (
          <div className="panel">
            <h3>Creator</h3>
            <strong>{s.creator.approved} approved</strong>
            <p>
              {s.creator.submitted} tracked contributions ·{' '}
              {s.creator.milestones} milestones
            </p>
            <small>
              {s.creator.rewardPoints} approved reward points (not confirmed
              payout)
            </small>
          </div>
        )}
        {s.categories
          .filter(
            (c) =>
              !['DUELS', 'SURVIVAL', 'MARKETPLACE', 'CREATOR'].includes(
                c.category,
              ),
          )
          .map((c) => (
            <div className="panel" key={c.category}>
              <h3>{c.category.toLowerCase()}</h3>
              <strong>{c.events} recorded events</strong>
            </div>
          ))}
      </div>
      {s.charm.length > 0 && (
        <p className="tracked-charm">
          Tracked $CHARM ·{' '}
          {s.charm
            .map(
              (c) => `${c.direction.toLowerCase()}: ${formatAmount(c.amount)}`,
            )
            .join(' · ')}
        </p>
      )}
      <small>
        Available imported records. Not a wallet balance or a lifetime total.
        Refunds and wagers are shown separately.
      </small>
    </section>
  );
}
export async function ActivityView({
  collectorId,
  squigId,
  public: publicView = false,
  path,
  params,
  gallery = false,
}: {
  collectorId?: string;
  squigId?: string;
  public?: boolean;
  path: string;
  params: Record<string, string | string[] | undefined>;
  gallery?: boolean;
}) {
  const scope = { collectorId, squigId, public: publicView };
  const [page, freshness] = await Promise.all([
    gallery ? creationPage(scope, params) : activityPage(scope, params),
    historyFreshness(),
  ]);
  const query = (category: string, after?: string) =>
    `${path}?${new URLSearchParams({ category, order: page.filters.order, ...(after ? { after } : {}) })}`;
  return (
    <section className="passport" id="ecosystem">
      <div className="section-heading">
        <p className="eyebrow">TRACKED HISTORY / SOURCE-BACKED FACTS</p>
        <h2>{gallery ? 'Made by the Ugly.' : 'Ecosystem field notes.'}</h2>
        <p>History grows as sources are connected and verified.</p>
      </div>
      {!gallery && (
        <nav className="activity-filters" aria-label="Activity categories">
          {categories.map((c) => (
            <Link
              aria-current={page.filters.category === c ? 'page' : undefined}
              key={c}
              href={query(c)}
            >
              {c === 'CHARM' ? '$CHARM' : c.toLowerCase()}
            </Link>
          ))}
        </nav>
      )}
      <div className="inline">
        <Link
          href={`${path}?${new URLSearchParams({ category: page.filters.category, order: page.filters.order === 'oldest' ? 'newest' : 'oldest' })}`}
        >
          {page.filters.order === 'oldest' ? 'Newest first' : 'Oldest first'} ↕
        </Link>
      </div>
      {gallery ? (
        <div className="ecosystem-cards">
          {page.entries.map((e) => (
            <article className="panel" key={e.id}>
              <Artwork src={e.image} alt="Approved community contribution" />
              <h3>Approved contribution</h3>
              <time>
                {new Date(e.eventAt).toLocaleDateString('en-US', {
                  timeZone: 'UTC',
                })}
              </time>
              {e.details.map((d) => (
                <p key={d.label}>
                  {d.label}: {d.value}
                </p>
              ))}
            </article>
          ))}
        </div>
      ) : (
        <Timeline entries={page.entries} />
      )}
      {gallery && !page.entries.length && (
        <p className="empty-state">
          No public approved contributions on this page.
        </p>
      )}
      {page.next && (
        <Link className="button" href={query(page.filters.category, page.next)}>
          More history →
        </Link>
      )}
      <details className="history-coverage">
        <summary>Source coverage &amp; freshness</summary>
        {freshness.map((s) => (
          <p key={s.source}>
            {s.source} · {s.state.toLowerCase().replaceAll('_', ' ')}
            {s.updatedAt
              ? ` · updated ${new Date(s.updatedAt).toLocaleString('en-US', { timeZone: 'UTC' })} UTC`
              : ''}
            {s.availableFrom
              ? ` · earliest imported record ${s.availableFrom.slice(0, 10)}`
              : ''}
          </p>
        ))}
      </details>
    </section>
  );
}
