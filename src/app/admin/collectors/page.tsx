import Link from 'next/link';
import { notFound } from 'next/navigation';
import { adminActor } from '@/server/admin';
import { db } from '@/server/db';
import { CollectorRepair } from '@/components/collector-repair';
import { appEnvironment } from '@/domain/deployment';
import { SQUIGS_CONTRACT } from '@/domain/validation';
export const dynamic = 'force-dynamic';
export default async function Page() {
  if (!(await adminActor())) notFound();
  const [holders, mappings, publicProfiles, privateProfiles] =
    await Promise.all([
      db().squigOwnership.findMany({
        where: {
          isCurrent: true,
          squig: { chainId: 1, contractAddress: SQUIGS_CONTRACT },
          walletAddress: { not: '0x0000000000000000000000000000000000000000' },
        },
        distinct: ['walletAddress'],
        select: { walletAddress: true },
      }),
      db().discoveredWallet.findMany({
        where: { chainId: 1 },
        select: { walletAddress: true },
      }),
      db().collector.count({
        where: { isPublic: true, mergedIntoCollectorId: null },
      }),
      db().collector.count({
        where: { isPublic: false, mergedIntoCollectorId: null },
      }),
    ]);
  const mapped = new Set(mappings.map((m) => m.walletAddress));
  return (
    <>
      <section className="page-heading">
        <h1>Collector discovery diagnostics</h1>
        <p>
          {holders.length} current holder addresses ·{' '}
          {holders.filter((h) => mapped.has(h.walletAddress)).length} mapped ·{' '}
          {holders.filter((h) => !mapped.has(h.walletAddress)).length} unmapped
        </p>
        <p>
          {publicProfiles} public profiles · {privateProfiles} private profiles
        </p>
        <p>
          Private imported identities are not public holder profiles. Mapping a
          verified private wallet preserves its privacy.
        </p>
        <Link href="/admin/blockwallet">Manage blocked wallets →</Link>
        <Link href="/admin/collections">Field Guide calculations →</Link>
      </section>
      {appEnvironment() === 'staging' ? (
        <CollectorRepair />
      ) : (
        <p>Repair controls are available only in staging.</p>
      )}
    </>
  );
}
