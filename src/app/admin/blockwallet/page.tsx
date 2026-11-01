import Link from 'next/link';
import { notFound } from 'next/navigation';
import { adminActor } from '@/server/admin';
import { db } from '@/server/db';
import { WalletBlockControls } from '@/components/wallet-block-controls';
export const dynamic = 'force-dynamic';
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  if (!(await adminActor())) notFound();
  const query = await searchParams;
  const requested = Number(query.page);
  const count = await db().blockedWallet.count();
  const pages = Math.max(1, Math.ceil(count / 25));
  const page = Math.min(
    pages,
    Number.isSafeInteger(requested) && requested > 0 ? requested : 1,
  );
  const blocks = await db().blockedWallet.findMany({
    orderBy: [{ createdAt: 'desc' }, { walletAddress: 'asc' }],
    skip: (page - 1) * 25,
    take: 25,
  });
  return (
    <>
      <section className="page-heading">
        <h1>Blocked wallets</h1>
        <p>
          Admin moderation for Ethereum wallets. Blocking hides associated
          collector profiles from rankings, directories, Field Guides and
          sharing. It does not delete ownership history, stop indexing, or
          prevent sign-in.
        </p>
        <p>
          If a wallet belongs to a collector with several wallets, that
          collector’s entire public profile is hidden. Private preferences are
          preserved when unblocking.
        </p>
        <Link href="/admin/collectors">Collector diagnostics →</Link>
      </section>
      <section className="panel">
        <h2>Block a wallet</h2>
        <WalletBlockControls />
      </section>
      <section>
        <h2>
          {count} blocked {count === 1 ? 'wallet' : 'wallets'}
        </h2>
        {blocks.length === 0 && <p>No wallets are blocked.</p>}
        {blocks.map((block) => (
          <article className="panel" key={block.walletAddress}>
            <h3 style={{ overflowWrap: 'anywhere' }}>{block.walletAddress}</h3>
            <p>{block.reason}</p>
            <p>
              Blocked{' '}
              {block.createdAt
                .toISOString()
                .replace('T', ' ')
                .replace('.000Z', ' UTC')}
            </p>
            <WalletBlockControls
              walletAddress={block.walletAddress}
              blockedAt={block.createdAt.toISOString()}
            />
          </article>
        ))}
        <nav aria-label="Blocked wallet pages">
          {page > 1 && (
            <Link href={`/admin/blockwallet?page=${page - 1}`}>← Previous</Link>
          )}{' '}
          <span>
            Page {page} of {pages}
          </span>{' '}
          {page < pages && (
            <Link href={`/admin/blockwallet?page=${page + 1}`}>Next →</Link>
          )}
        </nav>
      </section>
    </>
  );
}
