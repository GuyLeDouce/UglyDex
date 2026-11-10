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
          {
            label: 'Traits Discovered',
            count: view.traits,
            total: view.traitTotal,
          },
          {
            label: 'Current Sets',
            count: view.currentSets,
            total: view.currentTotal,
          },
          { label: 'Current Collection', count: view.owned, total: null },
          {
            label: 'Historical Discoveries',
            count: view.discovered,
            total: 4444,
          },
        ].map(({ label, count, total }) => (
          <div key={label}>
            <div className="inline">
              <strong>{label}</strong>
              <span>
                {count.toLocaleString('en-US')}
                {total !== null && ` / ${total.toLocaleString('en-US')}`}
              </span>
            </div>
            {total !== null && (
              <progress max={total || 1} value={count} aria-label={label} />
            )}
          </div>
        ))}
        <small>
          Set Cards reflect current holdings. Sets Achieved remain in your
          history.
        </small>
        <details>
          <summary>How mastery is calculated</summary>
          <p>
            45% Traits + 35% Sets Achieved + 10% Current Holder + 10%
            Discoveries. Holding one or more Squigs earns the full holder
            credit; discoveries reach full credit at 250. Your discovery sets
            achieved: {view.historicalSets} / {view.historicalTotal}. Selling
            your last Squig removes the holder credit. Valid discoveries, Sets
            Achieved, and earned milestones remain.
          </p>
        </details>
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
export function SetHistory({ cards }: { cards: SetCard[] }) {
  return cards.length ? (
    <div className="panel table-scroll">
      <table aria-label="Set achievement history">
        <thead>
          <tr>
            <th>Set</th>
            <th>Status</th>
            <th>Progress</th>
          </tr>
        </thead>
        <tbody>
          {cards.map((card) => (
            <tr key={card.key}>
              <td>
                <Link href={`/sets/${card.key}`}>{card.name}</Link>
              </td>
              <td>
                {card.complete
                  ? 'Achieved'
                  : card.firstCompletedAt
                    ? 'Previously achieved'
                    : card.revealed
                      ? 'In progress'
                      : 'Undiscovered'}
              </td>
              <td>
                {card.revealed ? `${card.progress} / ${card.required}` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <p className="panel">No set history matches this view.</p>
  );
}
export function SetGrid({ cards }: { cards: SetCard[] }) {
  const current = cards.filter((c) => c.mode === 'CURRENT_HOLDING');
  const history = cards.filter((c) => c.mode === 'HISTORICAL_DISCOVERY');
  return cards.length ? (
    <>
      {!!history.length && <SetHistory cards={history} />}
      {!!current.length && (
        <div className="set-grid">
          {current.map((c) => (
            <SetTile key={c.key} card={c} />
          ))}
        </div>
      )}
    </>
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
