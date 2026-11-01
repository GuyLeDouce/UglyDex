import { collectorHandle } from '@/domain/profile';
import Link from 'next/link';
import { Artwork } from '@/components/artwork';
import { topCollectors } from '@/server/community';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Top Collectors | UglyDex' };
export default async function TopCollectors({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { page } = await searchParams;
  const number =
    typeof page === 'string' && /^\d{1,4}$/.test(page)
      ? Math.max(1, Number(page))
      : 1;
  let result;
  try {
    result = await topCollectors(number);
  } catch {
    return (
      <section className="empty-state">
        <h1>Top Collectors</h1>
        <Link href="/collectors/directory">
          Browse all collectors and unclaimed holders →
        </Link>
        <p>The leaderboard is temporarily unavailable.</p>
      </section>
    );
  }
  return (
    <>
      <section className="page-heading">
        <p className="eyebrow">THE FIELD GUIDE</p>
        <h1>Top Collectors</h1>
        <Link href="/collectors/directory">
          Browse all collectors and unclaimed holders →
        </Link>
        <p>Ranked by overall Field Guide completion. Every discovery counts.</p>
        <small>
          All public collectors and tracked wallets · Equal completion shares a
          rank.
        </small>
      </section>
      <p>
        Unclaimed wallets are included automatically and marked “Wallet not
        claimed”. Their scores reflect tracked wallet holdings and history, not
        verified personal attribution. Owners can turn public visibility off in
        settings.
      </p>
      {result.pending > 0 && (
        <p role="status">
          {result.pending.toLocaleString()} collector Field Guides are updating.
          These profiles remain visible; existing scores are marked as the last
          evaluation.
        </p>
      )}
      <ol
        className="collector-leaderboard"
        aria-label="Field Guide completion leaderboard"
      >
        {result.collectors.map((c) => (
          <li key={c.slug}>
            <Link className="collector-rank-card" href={'/collector/' + c.slug}>
              <span className="collector-rank">
                {c.rank === null ? '—' : '#' + c.rank}
              </span>
              <Artwork src={c.avatar} alt="" avatar />
              <div className="collector-rank-name">
                <h2>{c.displayName || c.slug}</h2>
                <p>{collectorHandle(c.slug, c.unclaimed)}</p>
                {c.unclaimed && <p className="badge">Wallet not claimed</p>}
                <small>{c.owned.toLocaleString()} Squigs currently held</small>
                <br />
                <small>
                  {c.discovered === null
                    ? 'Field Guide updating'
                    : `${c.discovered.toLocaleString()} ${c.unclaimed ? 'Squigs tracked in wallet history' : 'Squigs discovered'}`}
                </small>
              </div>
              <div className="collector-rank-score">
                <strong>
                  {c.overall === null ? 'Updating' : c.overall.toFixed(1) + '%'}
                </strong>
                <span>
                  {c.unclaimed ? 'Wallet Field Guide' : 'Field Guide complete'}
                </span>
                {c.pending && (
                  <small>
                    Updating ·{' '}
                    {c.overall === null
                      ? 'awaiting first evaluation'
                      : 'last evaluated score'}
                  </small>
                )}
                <progress
                  max={100}
                  value={c.overall ?? undefined}
                  aria-label={`${c.displayName || c.slug} Field Guide completion`}
                />
              </div>
            </Link>
          </li>
        ))}
      </ol>
      {!result.collectors.length && (
        <section className="empty-state">
          <h2>A new chapter is waiting.</h2>
          <p>
            Public wallet profiles appear automatically as ownership is indexed.
            No login is required to be listed.
          </p>
        </section>
      )}
      <nav className="pagination" aria-label="Leaderboard pages">
        {result.page > 1 ? (
          <Link href={`/collectors?page=${result.page - 1}`}>← Previous</Link>
        ) : (
          <span />
        )}
        <span>
          Page {result.page} of {result.pages} · {result.total} collectors
        </span>
        {result.page < result.pages ? (
          <Link href={`/collectors?page=${result.page + 1}`}>Next →</Link>
        ) : (
          <span />
        )}
      </nav>
    </>
  );
}
