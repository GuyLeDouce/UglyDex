import Link from 'next/link';
import { requireCollector } from '@/server/session';
import { db } from '@/server/db';
import { CharmDripLink } from '@/components/charm-drip-link';
import { Connect } from '@/components/connect';
import { WalletActions } from '@/components/wallet-actions';
export default async function Wallets() {
  const id = await requireCollector(),
    wallets = await db().collectorWallet.findMany({
      where: { collectorId: id },
      orderBy: [{ isPrimary: 'desc' }, { firstSeenAt: 'asc' }],
    });
  const [discord, drip] = await Promise.all([
    db().externalIdentity.count({
      where: {
        collectorId: id,
        provider: 'DISCORD',
        authenticatedAt: { not: null },
      },
    }),
    db().dripIdentity.count({ where: { collectorId: id } }),
  ]);
  return (
    <>
      <section className="page-heading">
        <p className="eyebrow">MANY WALLETS. ONE COLLECTOR.</p>
        <h1>Connected wallets.</h1>
        <p>
          Active, verified Ethereum wallets contribute to your collection.
          Revoking a wallet preserves its historical discoveries.
        </p>
        <Link href="/settings/profile">Profile & privacy settings →</Link>
      </section>
      <div className="wallet-list">
        {wallets.map((w) => (
          <section className="panel" key={w.id}>
            <div className="inline">
              <h2>{w.isPrimary ? 'Primary wallet' : 'Linked wallet'}</h2>
              <span className="badge">{w.status}</span>
            </div>
            <p className="wallet-line">
              {w.checksumAddress || w.walletAddress}
            </p>
            <p>
              {w.source} · Ethereum · Verified{' '}
              {w.verifiedAt.toLocaleDateString('en-US', { timeZone: 'UTC' })}
            </p>
            <small>
              Linked{' '}
              {w.firstSeenAt.toLocaleDateString('en-US', { timeZone: 'UTC' })} ·{' '}
              {w.status === 'ACTIVE'
                ? 'Contributes to current collection'
                : 'Historical evidence only'}
            </small>
            {w.status === 'ACTIVE' && (
              <WalletActions id={w.id} isPrimary={w.isPrimary} />
            )}
          </section>
        ))}
      </div>
      <section className="panel">
        <h2>Account connections</h2>
        <p>
          Discord: {discord ? 'Connected' : 'Not connected'} · DRIP:{' '}
          {drip ? 'Connected' : 'Not connected'}
        </p>
        <p>
          Discord and DRIP identifiers are private. Discord authorization is
          independent of UglyBot verification.
        </p>
      </section>
      <CharmDripLink />
      <section className="panel">
        <h2>Link another identity</h2>
        <p>
          Select a different account in your wallet, then sign a new
          verification message. If wallet sharing is enabled in Profile &
          privacy, each linked wallet will be publicly associated with your
          collector profile. Disable wallet sharing before linking if you want
          that association kept private.
        </p>
        <Connect />
      </section>
    </>
  );
}
