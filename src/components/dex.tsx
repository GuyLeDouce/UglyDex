import Link from 'next/link';
import { dexView, type DexView, type SetCard } from '@/server/dex';
export function DexNav() {
  return (
    <nav className="anchor-nav" aria-label="Dex navigation">
      <Link href="/collection/dex">Dex overview</Link>
      <Link href="/me/achievements">My achievements</Link>
      <Link href="/me/activity">Survival & Duels history</Link>
      <Link href="/collection/traits">Trait Dex</Link>
      <Link href="/collection/sets">Collection sets</Link>
      <Link href="/collection/editions">Customs</Link>
      <Link href="/collection/discovered">Discoveries</Link>
    </nav>
  );
}
export function DexScore({ view }: { view: DexView }) {
  if (!view) return null;
  if (view.status === 'pending')
    return (
      <section className="panel">
        <p className="eyebrow">FIELD GUIDE MASTERY</p>
        <h2>Your field notes are updating.</h2>
        <p>
          Confirmed history is being evaluated. Browse the catalog while your
          collection worker catches up.
        </p>
      </section>
    );
  return (
    <section className="dex-score">
      <div>
        <p className="eyebrow">FIELD GUIDE MASTERY</p>
        <h2>
          {view.score.overall.toFixed(1)}
          <span>%</span>
        </h2>
        <p>
          {view.basis === 'wallet'
            ? 'Wallet Field Guide · tracked public ownership, owner not verified.'
            : 'A field guide built from real discoveries.'}
        </p>
        {view.basis === 'wallet' && (
          <p>
            {view.owned} Squigs currently held. Historical coverage includes
            indexed, reconciled wallet records; it does not identify the person
            who held them.
          </p>
        )}
        <small>
          Last evaluated{' '}
          <time dateTime={view.updatedAt}>
            {new Date(view.updatedAt).toLocaleString('en-US', {
              timeZone: 'UTC',
            })}{' '}
            UTC
          </time>
          . Ownership updates and Field Guide evaluation can finish at different
          times.
        </small>
      </div>
      <div className="dex-breakdown">
        {[
          [
            'Traits Discovered — 45% Weight',
            view.traits,
            view.traitTotal,
            view.score.trait,
          ],
          [
            'Historical Sets — 35% Weight',
            view.historicalSets,
            view.historicalTotal,
            view.score.sets,
          ],
          [
            'Current Collection — 10% Weight',
            view.owned,
            100,
            view.score.holdings,
          ],
          [
            'Historical Discoveries — 10% Weight',
            view.discovered,
            250,
            view.score.squig,
          ],
        ].map(([label, n, total, percent]) => (
          <div key={label}>
            <div className="inline">
              <strong>{label}</strong>
              <span>
                {n} / {total} · {Number(percent).toFixed(1)}%
              </span>
            </div>
            <progress max={100} value={percent} aria-label={String(label)} />
          </div>
        ))}
        <small>
          45% Traits + 35% Historical Sets + 10% Holdings + 10% Discoveries
          <br />
          Holdings reach full credit at 100; discoveries at 250. Actual counts
          remain visible. Mastery can decrease after a sale; earned milestones
          remain.
          <br />
          Current holding sets are tracked separately: {view.currentSets}{' '}
          complete.
        </small>
      </div>
    </section>
  );
}
export function SetTile({ card }: { card: SetCard }) {
  return (
    <Link
      className={`set-tile ${card.complete ? 'set-complete' : ''}`}
      href={`/sets/${card.key}`}
    >
      <div className="tags">
        <span>
          {card.mode === 'CURRENT_HOLDING'
            ? 'CURRENT HOLDING'
            : 'HISTORICAL DISCOVERY'}
        </span>
        <span>{card.difficulty}</span>
      </div>
      <h3>
        {card.complete ? '✳ ' : ''}
        {card.name}
      </h3>
      <p>{card.description}</p>
      {card.revealed ? (
        <>
          <progress
            max={card.required || 1}
            value={Math.min(card.progress, card.required)}
            aria-label={`${card.name} progress`}
          />
          <p className="inline">
            <strong>
              {card.complete
                ? 'Complete'
                : card.progress
                  ? 'In progress'
                  : 'Not started'}
            </strong>
            <span>
              {card.progress} / {card.required}
            </span>
          </p>
        </>
      ) : (
        <p>Secret field note</p>
      )}
    </Link>
  );
}
export function SetGrid({ cards }: { cards: SetCard[] }) {
  return cards.length ? (
    <div className="set-grid">
      {cards.map((c) => (
        <SetTile key={c.key} card={c} />
      ))}
    </div>
  ) : (
    <p className="panel">No sets match this view.</p>
  );
}
export async function DexSummary({
  id,
  public: publicView = false,
  path = '/collection/dex',
}: {
  id: string;
  public?: boolean;
  path?: string;
}) {
  const view = await dexView(id, publicView);
  if (!view) return null;
  return (
    <section className="dex-summary">
      <DexScore view={view} />
      <Link className="text-link" href={path}>
        Open collection field guide →
      </Link>
      {view.status === 'ready' && view.cards.some((c) => c.featured) && (
        <>
          <h2>Featured collections.</h2>
          <SetGrid cards={view.cards.filter((c) => c.featured)} />
        </>
      )}
    </section>
  );
}

export function DiscoveryActions() {
  return (
    <section
      className="discovery-actions"
      aria-label="Find your next discovery"
    >
      <p className="eyebrow">WHAT WILL YOU DISCOVER NEXT?</p>
      <nav className="actions" aria-label="Discovery shortcuts">
        <Link
          className="button primary"
          href="/collection/traits?state=missing"
        >
          Missing traits →
        </Link>
        <Link className="button" href="/collection/sets?state=incomplete">
          Unfinished sets →
        </Link>
        <Link className="button" href="/squigs?dex=advances&sort=sets-desc">
          Squigs that advance my sets →
        </Link>
      </nav>
    </section>
  );
}
