import Link from 'next/link';
import { requireCollector } from '@/server/session';
import { dexView } from '@/server/dex';
import { DexNav, DexScore, SetGrid } from '@/components/dex';
export default async function Page() {
  const view = await dexView(await requireCollector());
  const cards = view?.status === 'ready' ? view.cards : [];
  const closest = cards
    .filter((c) => c.revealed && !c.complete && c.progress > 0)
    .sort(
      (a, b) =>
        b.progress / b.required - a.progress / a.required ||
        a.key.localeCompare(b.key),
    )
    .slice(0, 6);
  const recent = cards
    .filter((c) => c.complete)
    .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))
    .slice(0, 3);
  return (
    <>
      <section className="page-heading">
        <p className="eyebrow">A FIELD GUIDE TO YOUR STRANGE</p>
        <h1>Leave no ugly unexplored.</h1>
        <p>
          Every legitimate discovery leaves a mark. Every missing trait is
          another direction to explore.
        </p>
      </section>
      <DexNav />
      <DexScore view={view} />
      <section className="section-heading">
        <h2>What should I hunt?</h2>
        <p>Collection gaps, drawn from your indexed history.</p>
      </section>
      <div className="anchor-nav">
        <Link className="button" href="/squigs?dex=advances">
          Advances my UglyDex ↗
        </Link>
        <Link className="button" href="/squigs?dex=traits">
          Missing traits ↗
        </Link>
        <Link className="button" href="/squigs?dex=undiscovered">
          Undiscovered Squigs ↗
        </Link>
      </div>
      <h2>Closest sets.</h2>
      <SetGrid cards={closest} />
      <h2>Recently completed.</h2>
      <SetGrid cards={recent} />
      <p className="muted">
        Historical discoveries survive a sale. Current sets require simultaneous
        holdings and may become incomplete. Evidence corrections can change
        either.
      </p>
      {view?.status === 'ready' && (
        <small>
          Evaluated{' '}
          {new Date(view.updatedAt).toLocaleString('en-US', {
            timeZone: 'UTC',
          })}{' '}
          UTC
        </small>
      )}
    </>
  );
}
