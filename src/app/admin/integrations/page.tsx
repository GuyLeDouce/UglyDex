import { notFound } from 'next/navigation';
import { inspectIntegrations } from '@/integrations/inspect';
import { internalMetrics } from '@/server/metrics';
export const dynamic = 'force-dynamic';
export default async function IntegrationsPage() {
  if (process.env.NODE_ENV !== 'development') notFound();
  const results = await inspectIntegrations();
  const metrics = await internalMetrics();
  return (
    <>
      <section className="page-heading">
        <p className="eyebrow">DEVELOPMENT DIAGNOSTICS</p>
        <h1>Integration health</h1>
        <p>
          Source schema and connection status. No personal records or
          credentials.
        </p>
      </section>
      <div className="profile-grid">
        <section className="panel">
          <h2>UglyDex index</h2>
          <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
            {JSON.stringify(metrics, null, 2)}
          </pre>
        </section>
        {results.map((r) => (
          <section className="panel" key={r.integration}>
            <h2>{r.integration}</h2>
            <p>{r.status}</p>
            {r.tables.map((t) => (
              <p key={t.table}>
                {t.table}:{' '}
                {t.present
                  ? `${t.missingRequired.length} missing required columns`
                  : 'not found'}
              </p>
            ))}
          </section>
        ))}
      </div>
    </>
  );
}
