import Link from 'next/link';
import { notFound } from 'next/navigation';
import { collectionSets } from '@/domain/dex-catalog';
import { currentSession } from '@/server/auth';
import { dexView, setProjection, completionCount } from '@/server/dex';
export default async function Page({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params,
    set = collectionSets.find((s) => s.key === key);
  if (!set) notFound();
  const session = await currentSession(),
    view = session ? await dexView(session.collectorId) : null,
    card =
      view?.status === 'ready'
        ? view.cards.find((c) => c.key === key)!
        : setProjection(set, undefined, false);
  const count = card.revealed ? await completionCount(key) : null;
  return (
    <>
      <section className="page-heading">
        <p className="eyebrow">
          {card.mode.replaceAll('_', ' ')} · {card.difficulty}
        </p>
        <h1>{card.name}</h1>
        <p>{card.description}</p>
        {view?.status === 'pending' && <p>Your progress is updating.</p>}
        {!session && (
          <Link className="button" href="/connect">
            Connect to track this set
          </Link>
        )}
      </section>
      {card.revealed && (
        <>
          <div className="panel">
            <h2>{card.complete ? 'Complete' : 'Field checklist'}</h2>
            <progress
              max={card.required}
              value={card.progress}
              aria-label="Set progress"
            />
            <p>
              {card.progress} / {card.required}
            </p>
            {card.requirements.map((r, i) => (
              <section className="set-requirement" key={i}>
                <h3>
                  {r.count >= r.required ? '✓ ' : ''}
                  {r.label}
                </h3>
                <p>
                  {r.count} / {r.required} · {Math.max(0, r.required - r.count)}{' '}
                  still needed
                </p>
                <div className="tags">
                  {r.tokens.map((t) => (
                    <Link key={t} href={`/squig/${t}`}>
                      #{t}
                    </Link>
                  ))}
                </div>
                {r.count < r.required && (
                  <Link className="text-link" href={r.explorer}>
                    Explore matching Squigs →
                  </Link>
                )}
              </section>
            ))}
          </div>
          {card.firstCompletedAt && (
            <p>
              First{' '}
              {card.mode === 'CURRENT_HOLDING'
                ? 'observed complete'
                : 'completion recorded'}
              :{' '}
              {new Date(card.firstCompletedAt).toLocaleDateString('en-US', {
                timeZone: 'UTC',
              })}
              . {card.completionCount} completion transition(s) recorded.{' '}
              {card.completedAt &&
                `Current qualifying completion: ${new Date(card.completedAt).toLocaleDateString('en-US', { timeZone: 'UTC' })}.`}
            </p>
          )}
          <p>
            {count} public UglyDex Collectors currently complete this set. This
            is not a count of all NFT holders.
          </p>
          <p className="muted">
            {card.mode === 'CURRENT_HOLDING'
              ? 'Requires simultaneous current holdings. Selling or revoking a wallet may make this incomplete. First observed completion remains in the audit.'
              : 'Uses confirmed historical discoveries. Selling a Squig does not erase discovery. Invalidated identity or provenance evidence can revise completion.'}
          </p>
        </>
      )}
      <Link href="/collection/sets">All collection sets →</Link>
    </>
  );
}
