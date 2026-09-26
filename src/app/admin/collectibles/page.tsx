import Link from 'next/link';
import { notFound } from 'next/navigation';
import { adminActor } from '@/server/admin';
import { db } from '@/server/db';
import { verifyCollectibles } from '@/server/collectibles-verify';
import { recentEditionOwnershipCount } from '@/server/editions';
export default async function Page() {
  if (!(await adminActor())) notFound();
  const [customs, editions, assets, checks, ownership] = await Promise.all([
    db().squigCustom.groupBy({ by: ['status'], _count: true }),
    db().squigEdition.groupBy({ by: ['status'], _count: true }),
    db().collectibleArtwork.count(),
    verifyCollectibles(),
    recentEditionOwnershipCount(),
  ]);
  return (
    <>
      <Link href="/admin/production">← Production</Link>
      <h1>Official collectibles</h1>
      <nav className="anchor-nav">
        <Link href="/admin/customs">Customs catalog</Link>
        <Link href="/admin/editions">Editions catalog</Link>
      </nav>
      <div className="stats">
        {customs.map((c) => (
          <div key={'c' + c.status}>
            <strong>{c._count}</strong>
            <span>{c.status} Customs</span>
          </div>
        ))}
        {editions.map((c) => (
          <div key={'e' + c.status}>
            <strong>{c._count}</strong>
            <span>{c.status} Editions</span>
          </div>
        ))}
      </div>
      <p>
        {assets} validated artwork assets. {ownership} recent positive wallet
        ownership observations (not unique Collectors).
      </p>
      <p>
        Edition ownership is checked on demand against reviewed Ethereum
        contracts; there is no inferred legacy ownership or automatic Edition
        history backfill.
      </p>
      <ul>
        {checks.map((c) => (
          <li key={c.name}>
            <strong>
              {c.status} · {c.name}
            </strong>{' '}
            — {c.detail}
          </li>
        ))}
      </ul>
      <p>
        Run <code>npm run collectibles:verify</code> to revalidate artwork
        bytes. No external repository or database is modified by these tools.
      </p>
    </>
  );
}
