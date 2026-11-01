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
          Claimed public profiles with an up-to-date Field Guide · Equal
          completion shares a rank.
        </small>
      </section>
      <p className="panel">
        {result.unclaimed.toLocaleString()} unclaimed wallet profiles are listed
        in the <Link href="/collectors/directory">holder directory</Link>, not
        ranked as verified collector Field Guides. Indexed wallet holdings are
        distinct from personal discoveries. Private profiles are not listed.
      </p>
      {result.pending > 0 && (
        <p role="status">
          {result.pending.toLocaleString()} public collector profiles are
          awaiting Field Guide evaluation and are not ranked yet. Current
          holdings remain available in the collector directory.
        </p>
      )}
      <ol
        className="collector-leaderboard"
        aria-label="Field Guide completion leaderboard"
      >
        {result.collectors.map((c) => (
          <li key={c.slug}>
            <Link className="collector-rank-card" href={'/collector/' + c.slug}>
              <span className="collector-rank">#{c.rank}</span>
              <Artwork src={c.avatar} alt="" avatar />
              <div className="collector-rank-name">
                <h2>{c.displayName || c.slug}</h2>
                <p>{collectorHandle(c.slug, c.unclaimed)}</p>
                <small>{c.discovered.toLocaleString()} Squigs discovered</small>
              </div>
              <div className="collector-rank-score">
                <strong>{c.overall.toFixed(1)}%</strong>
                <span>Field Guide complete</span>
                <progress
                  max={100}
                  value={c.overall}
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
            Collectors appear after claiming their profile, making it public,
            and completing Field Guide evaluation. Unclaimed wallets are not
            shown as zero-score collectors.
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
