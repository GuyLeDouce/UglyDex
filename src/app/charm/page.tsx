import Link from 'next/link';
import { requireCollector } from '@/server/session';
import { charmBalance } from '@/server/drip-sync';
import { charmHistory } from '@/server/charm-history';
import { CharmBalanceCard } from '@/components/charm-balance';
import { CharmRefresh } from '@/components/charm-refresh';
import { charmDirections } from '@/domain/charm';
import { formatAmount } from '@/domain/activity';
export const metadata = {
  title: 'Your $CHARM | UglyDex',
  robots: { index: false, follow: false },
};
export default async function Charm({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const id = await requireCollector(),
    params = await searchParams;
  const [balance, history] = await Promise.all([
    charmBalance(id),
    charmHistory(id, params),
  ]);
  const next = new URLSearchParams(
    Object.entries(params).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
  next.set('page', String(history.filters.page + 1));
  return (
    <>
      <section className="page-heading">
        <p className="eyebrow">YOUR ECOSYSTEM CURRENCY</p>
        <h1>$CHARM</h1>
        <Link href="/me">Back to your UglyDex</Link>
      </section>
      <CharmBalanceCard value={balance} />
      <CharmRefresh />
      <section className="panel">
        <h2>Tracked activity</h2>
        <p>
          Tracked available ecosystem history. These records do not reconstruct
          your current balance.
        </p>
        <div className="profile-grid">
          {charmDirections
            .filter((d) => d !== 'OBSERVATION')
            .map((direction) => (
              <div key={direction}>
                <h3>{direction}</h3>
                <p>
                  {formatAmount(
                    history.totals.find((t) => t.direction === direction)
                      ?.amount ?? '0',
                  )}{' '}
                  $CHARM
                </p>
              </div>
            ))}
        </div>
        <form className="filters">
          <label>
            Source
            <select name="source" defaultValue={history.filters.source ?? ''}>
              <option value="">All sources</option>
              {history.sources.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            Direction
            <select
              name="direction"
              defaultValue={history.filters.direction ?? ''}
            >
              <option value="">All directions</option>
              {charmDirections.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </label>
          <label>
            From
            <input
              type="date"
              name="from"
              defaultValue={history.filters.from}
            />
          </label>
          <label>
            To
            <input type="date" name="to" defaultValue={history.filters.to} />
          </label>
          <button>Filter</button>
        </form>
        <ol className="timeline">
          {history.entries.map((e) => (
            <li key={e.id}>
              <time dateTime={e.at}>
                {new Date(e.at).toLocaleDateString('en-CA', {
                  timeZone: 'UTC',
                })}
              </time>
              <h3>{e.label}</h3>
              <p>
                {e.source} ·{' '}
                {e.direction === 'OBSERVATION'
                  ? 'Observation only — payout not confirmed'
                  : e.direction}
              </p>
              {e.amount !== null && <p>{formatAmount(e.amount)} $CHARM</p>}
            </li>
          ))}
        </ol>
        {!history.entries.length && (
          <p>No tracked activity matches these filters.</p>
        )}
        {history.more && <Link href={'/charm?' + next}>Older activity →</Link>}
      </section>
    </>
  );
}
