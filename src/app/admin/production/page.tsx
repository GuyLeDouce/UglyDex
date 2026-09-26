import Link from 'next/link';
import { notFound } from 'next/navigation';
import { adminActor } from '@/server/admin';
import { productionOverview } from '@/server/production';
import { heartbeatState, backfillStages } from '@/domain/operations';
import { WorkerControls } from '@/components/worker-controls';
import { reliabilityReport } from '@/server/reliability';
import { launchReport } from '@/server/launch';
export default async function Page() {
  if (!(await adminActor())) notFound();
  const [p, reliability, launch] = await Promise.all([
    productionOverview(),
    reliabilityReport(),
    launchReport(),
  ]);
  return (
    <div className="production-console">
      <h1>Production command centre</h1>
      <section aria-label="Launch Readiness">
        <h2>Launch Readiness — {launch.overall}</h2>
        <p>Migration: {launch.migration ?? 'Unavailable'}</p>
        <ul>
          {launch.catalogs.map((c) => (
            <li key={c.kind + c.id}>
              {c.kind}: {c.id} · <code>{c.fingerprint}</code>
            </li>
          ))}
        </ul>
        <p>
          {launch.environment} · {launch.blockingPassed} blocking gates verified
          · {launch.blockingPending} blocking gates outstanding ·{' '}
          {launch.warnings} warnings · {launch.failed} failed.
        </p>
        <p>
          Evidence expires after 24 hours and must match this deployment and
          commit.
        </p>
        <a href="/api/admin/launch">Export JSON</a>
        {' · '}
        <a href="/api/admin/launch?format=text">Export text</a>
        <ul>
          {launch.gates.map((g) => (
            <li key={g.key}>
              <strong>
                {g.status} · {g.key}
              </strong>
              {g.blocking ? ' (blocking)' : ''} — {g.summary}
            </li>
          ))}
        </ul>
      </section>
      <p>
        Release: <code>{p.version}</code>. External probes and schema drift
        checks run through <code>npm run production:preflight</code>.
      </p>
      <nav className="tabs">
        <Link href="/admin/integrations">Integrations</Link>
        <Link href="/admin/provenance">Provenance</Link>
        <Link href="/admin/sharing">Rendering</Link>
        <Link href="/admin/collectibles">Collectibles</Link>
      </nav>
      <h2>Subsystem status and alerts</h2>
      <ul>
        {reliability.systems.map((s) => (
          <li key={s.name}>
            <strong>
              {s.status} · {s.name}
            </strong>{' '}
            — {s.detail}
          </li>
        ))}
      </ul>
      <p>
        {reliability.alerts.length} degraded/failed subsystems. Data quality:{' '}
        {reliability.quality.rejected} rejected records,{' '}
        {reliability.quality.unresolvedIdentity} identity reviews,{' '}
        {reliability.quality.failedProgression} failed progression jobs,{' '}
        {reliability.quality.failedCollections} failed collection jobs.
      </p>
      <Link href="/admin/reconciliation">Review identity evidence</Link>
      {' · '}
      <Link href="/admin/editions">Edition catalog</Link>
      <details>
        <summary>Recent operational incidents and gates</summary>
        <ul>
          {reliability.incidents.map((i, n) => (
            <li key={n}>
              {i.createdAt.toISOString()} · {i.action} · {i.subject}
            </li>
          ))}
        </ul>
      </details>
      <h2>Readiness</h2>
      <ul>
        {p.checks.map((c) => (
          <li key={c.name}>
            <strong>
              {c.status} · {c.name}
            </strong>{' '}
            — {c.detail}
          </li>
        ))}
      </ul>
      <h2>Workers</h2>
      <WorkerControls controls={p.controls} />
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Service</th>
              <th>State</th>
              <th>Mode / lock</th>
              <th>Heartbeat</th>
              <th>Last success / error</th>
            </tr>
          </thead>
          <tbody>
            {p.workers.map((w) => (
              <tr key={w.service + w.instanceId}>
                <td>{w.service}</td>
                <td>{heartbeatState(w.lastHeartbeat, w.state)}</td>
                <td>
                  {w.mode} / {w.lockHeld ? 'held' : 'idle'}
                </td>
                <td>{w.lastHeartbeat.toISOString()}</td>
                <td>
                  {w.lastSuccessAt?.toISOString() ?? 'None'} {w.errorCode}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2>Backfill</h2>
      <p>
        Run <code>npm run production:backfill</code> for the safe plan. No scans
        are launched by this page.
      </p>
      <ol>
        {backfillStages.map((stage) => {
          const s = p.stages.find((s) => s.stage === stage);
          return (
            <li key={stage}>
              {stage}: {s?.status ?? 'NOT STARTED'} {s?.errorCode}{' '}
              {s && <code>{JSON.stringify(s.counts)}</code>}
            </li>
          );
        })}
      </ol>
      <h2>Evidence state</h2>
      <p>
        Chain: {p.chain?.blockNumber.toString() ?? 'Not indexed'} / finalized{' '}
        {p.chain?.finalizedBlock?.toString() ?? 'unknown'}. Last success:{' '}
        {p.chain?.lastSuccessAt?.toISOString() ?? 'none'}. {p.chain?.lastError}
      </p>
      <ul>
        {p.provenance.map((v) => (
          <li key={`${v.dirty}:${v.complete}`}>
            {v._count} Squigs: {v.dirty ? 'pending derivation' : 'settled'},{' '}
            {v.complete ? 'complete' : 'incomplete'} provenance
          </li>
        ))}
      </ul>
      <p>
        {p.pendingIdentity} unresolved reconciliation cases. Progression jobs:{' '}
        {p.progressionJobs.reduce((n, g) => n + g._count, 0)} (
        {p.progressionJobs
          .filter((g) => g.errorCode)
          .reduce((n, g) => n + g._count, 0)}{' '}
        failed). Collection jobs:{' '}
        {p.collectionJobs.reduce((n, g) => n + g._count, 0)} (
        {p.collectionJobs
          .filter((g) => g.errorCode)
          .reduce((n, g) => n + g._count, 0)}{' '}
        failed).
      </p>
      <h2>External history</h2>
      <ul>
        {p.sources.map((s) => (
          <li key={s.id}>
            {s.id}: {s.state} ·{' '}
            {s.backfillFinishedAt
              ? 'available source scanned'
              : 'history incomplete'}{' '}
            · last success {s.lastSuccessAt?.toISOString() ?? 'none'} ·{' '}
            {s.warning}
          </li>
        ))}
      </ul>
      <h2>Rules and rendering</h2>
      <ul>
        {p.rulesets.map((r) => (
          <li key={r.id}>
            {r.id}: {r.status}
          </li>
        ))}
        {p.renders.map((r) => (
          <li key={r.status}>
            {r.status}: {r._count} render events in 24 hours
          </li>
        ))}
      </ul>
      <h2>Recent jobs</h2>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Run</th>
              <th>Source</th>
              <th>Status</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {p.runs.map((r) => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{r.source}</td>
                <td>
                  {r.status} {r.errorCode}
                </td>
                <td>
                  {r.finishedAt?.toISOString() ?? r.startedAt.toISOString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
