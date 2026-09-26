import { notFound } from 'next/navigation';
import { adminActor } from '@/server/admin';
import { db } from '@/server/db';
import { shareSchema, shareQuery } from '@/domain/sharing';
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  if (!(await adminActor())) notFound();
  const [counts, metrics] = await Promise.all([
    db().collectorGallery.groupBy({
      by: ['visibility'],
      _count: { _all: true },
    }),
    db().shareRenderMetric.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
  ]);
  const q = await searchParams,
    parsed = shareSchema.safeParse(
      Object.fromEntries(Object.entries(q).filter(([, v]) => v !== '')),
    );
  return (
    <>
      <h1>Sharing diagnostics</h1>
      <p>
        Images are generated in the web service. HTTP responses are
        private/no-store. The 24-entry, 60-second process cache is read only
        after fresh privacy checks.
      </p>
      <div className="stats">
        {counts.map((c) => (
          <div key={c.visibility}>
            <strong>{c._count._all}</strong>
            <span>{c.visibility} galleries</span>
          </div>
        ))}
      </div>
      <h2>Public preview</h2>
      <form className="settings-form" method="get">
        <label>
          Card type
          <select name="kind">
            {[
              'collector',
              'squig',
              'passport',
              'completion',
              'achievement',
              'set',
              'gallery',
              'collage',
              'trophy',
              'milestone',
              'discovery',
            ].map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </label>
        <label>
          Collector slug or Squig token
          <input name="entity" required />
        </label>
        <label>
          Gallery / achievement / set / milestone key
          <input name="key" />
        </label>
        <button className="button">Preview public card</button>
      </form>
      {parsed.success && (
        <a className="button" href={'/api/share?' + shareQuery(parsed.data)}>
          Open permitted PNG ↗
        </a>
      )}
      <h2>Recent render health</h2>
      <p>
        {metrics.filter((m) => m.cacheHit).length} cache hits ·{' '}
        {metrics.reduce((n, m) => n + m.artworkFailures, 0)} artwork fallbacks
        in the latest {metrics.length} renders.
      </p>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Type</th>
              <th>Status</th>
              <th>Cache</th>
              <th>Artwork failures</th>
              <th>ms</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((m) => (
              <tr key={m.id}>
                <td>{m.createdAt.toISOString()}</td>
                <td>{m.kind}</td>
                <td>{m.status}</td>
                <td>{m.cacheHit ? 'hit' : 'miss'}</td>
                <td>{m.artworkFailures}</td>
                <td>{m.durationMs}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
