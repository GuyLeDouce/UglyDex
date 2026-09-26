import Link from 'next/link';
import { notFound } from 'next/navigation';
import { adminActor } from '@/server/admin';
import { chainStatus } from '@/server/provenance';
import { db } from '@/server/db';
import { squigToken, SQUIGS_CONTRACT } from '@/domain/validation';
import { RebuildButton } from '@/components/admin-review';
export const dynamic = 'force-dynamic';
const json = (v: unknown) =>
  JSON.stringify(v, (_, x) => (typeof x === 'bigint' ? x.toString() : x), 2);
export default async function Provenance({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; page?: string }>;
}) {
  if (!(await adminActor())) notFound();
  const p = await searchParams,
    page = Math.floor(Math.max(1, Math.min(10000, Number(p.page) || 1)));
  let token: number | undefined;
  try {
    if (p.token) token = squigToken(p.token);
  } catch {
    notFound();
  }
  const status = await chainStatus();
  const s = token
    ? await db().squig.findUnique({
        where: {
          chainId_contractAddress_tokenId: {
            chainId: 1,
            contractAddress: SQUIGS_CONTRACT,
            tokenId: token,
          },
        },
        include: {
          provenance: true,
          transfers: {
            orderBy: [{ blockNumber: 'desc' }, { logIndex: 'desc' }],
            take: 30,
            skip: (page - 1) * 30,
          },
          walletPeriods: {
            orderBy: { acquiredAt: 'desc' },
            take: 30,
            skip: (page - 1) * 30,
          },
          collectorPeriods: {
            orderBy: { acquiredAt: 'desc' },
            take: 30,
            skip: (page - 1) * 30,
          },
        },
      })
    : null;
  return (
    <>
      <div className="page-heading">
        <p className="eyebrow">INTERNAL / CHAIN OF CUSTODY</p>
        <h1>Provenance lab</h1>
        <Link href="/admin/reconciliation">Identity review →</Link>
      </div>
      <section className="panel">
        <h2>Sync state</h2>
        <pre>{json(status)}</pre>
      </section>
      <form className="passport-filters">
        <label>
          Squig token
          <input
            name="token"
            type="number"
            min="1"
            max="4444"
            required
            defaultValue={token}
          />
        </label>
        <button>Inspect</button>
      </form>
      {s && (
        <>
          <section className="panel">
            <h2>Squig #{s.tokenId}</h2>
            <pre>{json(s.provenance)}</pre>
            <RebuildButton tokenId={s.tokenId} />
          </section>
          {[
            ['Raw canonical transfers', s.transfers],
            ['Wallet periods', s.walletPeriods],
            ['Collector attribution periods', s.collectorPeriods],
          ].map(([label, rows]) => (
            <section className="panel" key={String(label)}>
              <h2>{String(label)}</h2>
              <pre>{json(rows)}</pre>
            </section>
          ))}
          <nav className="pagination">
            {page > 1 && (
              <Link href={`?token=${token}&page=${page - 1}`}>Previous</Link>
            )}
            <span>History page {page}</span>
            {s.transfers.length === 30 && (
              <Link href={`?token=${token}&page=${page + 1}`}>Next</Link>
            )}
          </nav>
        </>
      )}
    </>
  );
}
