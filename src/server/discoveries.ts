import 'server-only';
import { db } from './db';
// Reconcile only observations whose chain time is known and falls after proof.
// A stale pre-signature ownerOf snapshot must not manufacture a discovery today.
export async function reconcileCurrentDiscoveries(collectorId: string) {
  return db().$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${collectorId},0))`;
    const wallets = await tx.collectorWallet.findMany({
      where: { collectorId, status: 'ACTIVE', chainId: 1, revokedAt: null },
    });
    const rows = await tx.squigOwnership.findMany({
      where: {
        isCurrent: true,
        squig: { provenance: { is: null } },
        walletAddress: { in: wallets.map((w) => w.walletAddress) },
      },
    });
    const blocks = await tx.chainBlock.findMany({
      where: { chainId: 1, number: { in: rows.map((r) => r.blockNumber) } },
    });
    let reconciled = 0;
    for (const row of rows) {
      const wallet = wallets.find(
        (w) => w.walletAddress === row.walletAddress,
      )!;
      const block = blocks.find(
        (b) => b.number === row.blockNumber && b.hash === row.blockHash,
      );
      const observedAt =
        block?.timestamp ?? (row.source === 'transfer' ? row.acquiredAt : null);
      if (!observedAt || observedAt < wallet.verifiedAt) continue;
      await tx.squigDiscovery.upsert({
        where: { collectorId_squigId: { collectorId, squigId: row.squigId } },
        create: {
          collectorId,
          squigId: row.squigId,
          discoveredAt: observedAt,
          sourceKey: `linked:${row.sourceKey}`,
          everOwned: true,
        },
        update: { everOwned: true },
      });
      reconciled++;
    }
    return reconciled;
  });
}
