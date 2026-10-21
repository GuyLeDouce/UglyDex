import Link from 'next/link';
import { ShareCardPreview } from './share-card-preview';
import { collectorThread } from '@/server/community';

export async function CollectorThread({
  page = 1,
  preview = false,
}: {
  page?: number;
  preview?: boolean;
}) {
  let result;
  try {
    result = await collectorThread(page);
  } catch {
    return (
      <section className="panel">
        <h2>Collector thread</h2>
        <p>The thread is temporarily unavailable.</p>
      </section>
    );
  }
  return (
    <section
      className="collector-thread"
      aria-labelledby="collector-thread-title"
    >
      <div className="section-heading inline">
        <div>
          <p className="eyebrow">EARNED IN THE WILD</p>
          <h2 id="collector-thread-title">Collector thread</h2>
        </div>
        <Link href="/settings/profile">Sharing settings →</Link>
      </div>
      <p>Fresh achievements and completed sets from public collectors.</p>
      <div className="community-cards">
        {result.cards.map((c) => (
          <article
            className="community-card"
            key={`${c.slug}:${c.kind}:${c.key}`}
          >
            <header>
              <Link href={'/collector/' + c.slug}>{c.name}</Link>
              <time dateTime={c.at}>
                {new Date(c.at).toLocaleDateString('en-US', {
                  timeZone: 'UTC',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </time>
            </header>
            <Link
              href={c.path}
              aria-label={`${c.name} ${c.kind === 'achievement' ? 'earned' : 'completed'} ${c.title}`}
            >
              <ShareCardPreview
                card={c.card}
                avatar={c.avatar}
                name={c.name}
                kind={c.kind}
              />
            </Link>
          </article>
        ))}
      </div>
      {!result.cards.length && (
        <div className="empty-state">
          <h3>The next milestone could be yours.</h3>
          <p>
            Earned achievements and completed sets appear here automatically
            when collectors share their activity.
          </p>
        </div>
      )}
      {preview ? (
        <Link className="button" href="/thread">
          Open the collector thread →
        </Link>
      ) : (
        <nav className="pagination" aria-label="Collector thread pages">
          {page > 1 ? (
            <Link href={`/thread?page=${page - 1}`}>← Newer</Link>
          ) : (
            <span />
          )}
          <span>Page {page}</span>
          {result.hasMore ? (
            <Link href={`/thread?page=${page + 1}`}>Older →</Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </section>
  );
}
