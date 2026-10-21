import Link from 'next/link';
import Image from 'next/image';
import { Artwork } from './artwork';
import { threadIcon } from '@/domain/thread-icons';
import { ThreadRefresh } from './thread-refresh';
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
      {page === 1 && <ThreadRefresh />}
      <div className="section-heading inline">
        <div>
          <p className="eyebrow">EARNED IN THE WILD</p>
          <h2 id="collector-thread-title">Collector thread</h2>
        </div>
        <Link href="/settings/profile">Sharing settings →</Link>
      </div>
      <p>
        Achievements, completed sets, and confirmed Squig transfers. Updates
        every 30 seconds while this page is visible; transfers appear after
        indexing.
      </p>
      <div className="community-cards">
        {result.cards.map((c) => (
          <article
            className="community-card"
            key={`${c.slug}:${c.kind}:${c.key}`}
          >
            <div className="thread-row">
              {c.kind === 'transfer' ? (
                <Link
                  href={c.path}
                  className="thread-squig"
                  aria-label={`View ${c.name}`}
                >
                  <Artwork src={c.avatar} alt={c.name} />
                </Link>
              ) : (
                <>
                  <Artwork
                    src={c.avatar}
                    alt={`${c.name}'s profile picture`}
                    avatar
                  />
                  <Image
                    src={threadIcon(c.kind, c.key)}
                    width={28}
                    height={28}
                    alt=""
                    unoptimized
                    title={c.title}
                  />
                </>
              )}
              <span className="thread-copy">
                <strong>
                  {c.slug ? (
                    <Link href={`/collector/${c.slug}`}>{c.name}</Link>
                  ) : (
                    c.name
                  )}
                </strong>
                {c.kind === 'transfer' && c.recipient ? (
                  <Link
                    href={c.recipient.path}
                    title={`Transferred to ${c.recipient.name}`}
                  >
                    Transferred to {c.recipient.name}
                  </Link>
                ) : (
                  <Link href={c.path} title={c.title}>
                    {c.kind === 'achievement'
                      ? 'Earned '
                      : c.kind === 'set'
                        ? 'Completed '
                        : ''}
                    {c.title}
                  </Link>
                )}
              </span>
              <time dateTime={c.at} title={new Date(c.at).toUTCString()}>
                {new Date(c.at).toLocaleString('en-US', {
                  timeZone: 'UTC',
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}{' '}
                UTC
              </time>
              {c.kind === 'transfer' && (
                <Image
                  src={threadIcon(c.kind, c.key)}
                  width={28}
                  height={28}
                  alt="Transfer"
                  unoptimized
                  title="Squig transfer"
                />
              )}
            </div>
          </article>
        ))}
      </div>
      {!result.cards.length && (
        <div className="empty-state">
          <h3>The next milestone could be yours.</h3>
          <p>
            Achievements, completed sets, and indexed transfers appear here
            automatically. Public collector milestones respect their sharing
            settings.
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
