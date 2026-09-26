import Link from 'next/link';
import { adminActor } from '@/server/admin';
import { db } from '@/server/db';
import { notFound } from 'next/navigation';
import { inspectIntegrations } from '@/integrations/inspect';
import { internalMetrics } from '@/server/metrics';
export const dynamic = 'force-dynamic';
export default async function IntegrationsPage() {
  if (!(await adminActor())) notFound();
  const sources = await db().integrationSource.findMany({
    orderBy: { id: 'asc' },
  });
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
      <Link href="/admin/activity">Import runs and activity evidence →</Link>
      <div className="ecosystem-cards">
        {sources.map((s) => (
          <section className="panel" key={s.id}>
            <h2>{s.id}</h2>
            <p>
              {s.state} · schema {s.schemaValid ? 'valid' : 'unvalidated'}
            </p>
            <p>
              Earliest imported:{' '}
              {s.firstAvailableAt?.toISOString() ?? 'unknown'}
            </p>
            <p>
              Latest imported: {s.importedThrough?.toISOString() ?? 'unknown'}
            </p>
            <p>Last success: {s.lastSuccessAt?.toISOString() ?? 'never'}</p>
            <p>{s.warning}</p>
          </section>
        ))}
      </div>
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
