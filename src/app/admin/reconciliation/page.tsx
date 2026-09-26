import { notFound } from 'next/navigation';
import { adminActor } from '@/server/admin';
import { db } from '@/server/db';
import { ReviewForm } from '@/components/admin-review';
import Link from 'next/link';
export const dynamic = 'force-dynamic';
export default async function Reconciliation({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string }>;
}) {
  if (!(await adminActor())) notFound();
  const params = await searchParams;
  const status =
    params.status === 'RESOLVED'
      ? 'RESOLVED'
      : params.status === 'REJECTED'
        ? 'REJECTED'
        : 'PENDING';
  const page = Math.floor(
    Math.max(1, Math.min(10000, Number(params.page) || 1)),
  );
  const cases = await db().identityReconciliation.findMany({
    where: { status },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    skip: (page - 1) * 20,
    take: 20,
    include: { decisions: { orderBy: { createdAt: 'desc' }, take: 5 } },
  });
  const attributions = await db().historicalIdentityAttribution.findMany({
    where: {
      OR: cases.map((c) => {
        const e = c.evidence as Record<string, string>;
        return e.attributionId
          ? { id: e.attributionId }
          : { walletAddress: e.wallet ?? 'none' };
      }),
    },
    include: { collector: { select: { slug: true } } },
  });
  return (
    <>
      <div className="page-heading">
        <p className="eyebrow">INTERNAL / AUDITED IDENTITY REVIEW</p>
        <h1>Reconciliation</h1>
        <p>
          Confirm only the interval supported by evidence. A signature today
          does not prove past control.
        </p>
        <Link href="/admin/provenance">Provenance diagnostics →</Link>
        <nav className="anchor-nav" aria-label="Review status">
          <Link href="?status=PENDING">Pending</Link>
          <Link href="?status=RESOLVED">Resolved audit</Link>
          <Link href="?status=REJECTED">Rejected audit</Link>
        </nav>
      </div>
      {cases.map((c) => {
        const e = c.evidence as Record<string, string>,
          rows = attributions.filter(
            (a) => a.id === e.attributionId || a.walletAddress === e.wallet,
          );
        return (
          <section className="panel" key={c.id}>
            <h2>{c.reason.replaceAll('_', ' ')}</h2>
            <pre>{JSON.stringify(c.evidence, null, 2)}</pre>
            {rows.map((a) => (
              <p key={a.id}>
                {a.id} · {a.collector.slug} · {a.walletAddress} · {a.status} ·{' '}
                {a.effectiveFrom.toISOString()} —{' '}
                {a.effectiveTo?.toISOString() ?? 'open'}
              </p>
            ))}
            {rows.length ? (
              <ReviewForm
                caseId={c.id}
                attributionIds={rows.map((a) => a.id)}
              />
            ) : (
              <p>
                This Phase 0 account-link case requires separate credential
                review. It cannot authorize historical attribution.
              </p>
            )}
            <details>
              <summary>Recent audit decisions</summary>
              {c.decisions.map((d) => (
                <p key={d.id}>
                  {d.createdAt.toISOString()} · {d.actor} · {d.action} ·{' '}
                  {d.reason}
                </p>
              ))}
            </details>
          </section>
        );
      })}
      {!cases.length && <p>No {status.toLowerCase()} cases.</p>}
      <nav className="pagination">
        {page > 1 && (
          <Link href={`?status=${status}&page=${page - 1}`}>Previous</Link>
        )}
        <span>Page {page}</span>
        {cases.length === 20 && (
          <Link href={`?status=${status}&page=${page + 1}`}>Next</Link>
        )}
      </nav>
    </>
  );
}
