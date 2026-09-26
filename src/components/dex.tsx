import Link from 'next/link';
import { dexView, type DexView, type SetCard } from '@/server/dex';
export function DexNav() {
  return (
    <nav className="anchor-nav" aria-label="Dex navigation">
      <Link href="/collection/dex">Dex overview</Link>
      <Link href="/collection/traits">Trait Dex</Link>
      <Link href="/collection/sets">Collection sets</Link>
      <Link href="/collection/discovered">Discoveries</Link>
    </nav>
  );
}
export function DexScore({ view }: { view: DexView }) {
  if (!view) return null;
  if (view.status === 'pending')
    return (
      <section className="panel">
        <p className="eyebrow">UGLYDEX COMPLETION</p>
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
        <p className="eyebrow">UGLYDEX COMPLETION · V1</p>
        <h2>
          {view.score.overall.toFixed(1)}
          <span>%</span>
        </h2>
        <p>A field guide built from real discoveries.</p>
      </div>
      <div className="dex-breakdown">
        {[
          ['Squigs discovered', view.discovered, 4444, view.score.squig],
          ['Traits discovered', view.traits, view.traitTotal, view.score.trait],
          [
            'Historical sets',
            view.historicalSets,
            view.historicalTotal,
            view.score.sets,
          ],
        ].map(([label, n, total, percent]) => (
          <div key={label}>
            <div className="inline">
              <strong>{label}</strong>
              <span>
                {n} / {total}
              </span>
            </div>
            <progress max={100} value={percent} aria-label={String(label)} />
          </div>
        ))}
        <small>
          40% Squigs + 35% traits + 25% visible historical sets.
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
