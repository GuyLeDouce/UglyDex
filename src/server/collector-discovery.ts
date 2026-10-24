import 'server-only';
import { randomUUID } from 'node:crypto';
import { db } from './db';
import type { Prisma } from '@/generated/prisma/client';
import { normalizeWallet, SQUIGS_CONTRACT } from '@/domain/validation';

/** Call only for canonical ownership. The address lock is shared with SIWE. */
export async function discoverHolder(
  tx: Prisma.TransactionClient,
  address: string,
) {
  const walletAddress = normalizeWallet(address);
  if (walletAddress === '0x0000000000000000000000000000000000000000')
    return null;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${walletAddress}, 0))`;
  const key = { chainId: 1, walletAddress };
  const existing = await tx.discoveredWallet.findUnique({
    where: { chainId_walletAddress: key },
  });
  if (existing) return existing;
  const credential = await tx.collectorWallet.findUnique({
    where: { chainId_walletAddress: key },
  });
  // A revoked association must not become public again through discovery.
  if (credential?.status === 'REVOKED') return null;
  const collectorId =
    credential?.collectorId ??
    (
      await tx.collector.create({
        data: {
          slug: `holder-${randomUUID()}`,
          isPublic: true,
          showWallets: true,
          showCommunityActivity: false,
        },
      })
    ).id;
  const result = await tx.discoveredWallet.create({
    data: { ...key, collectorId },
  });
  await tx.operationalAudit.create({
    data: {
      actor: 'ownership-index',
      action: 'COLLECTOR_DISCOVERED',
      subject: collectorId,
      detail: { chainId: 1, createdProfile: !credential },
    },
  });
  return result;
}

/** Bounded keyset pass. Repeat from the beginning to reconcile new addresses. */
export async function backfillHolders({
  dryRun = true,
  after = '',
  limit = 100,
}: {
  dryRun?: boolean;
  after?: string;
  limit?: number;
} = {}) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 500)
    throw new Error('INVALID_BATCH_SIZE');
  const rows = await db().squigOwnership.findMany({
    where: {
      isCurrent: true,
      walletAddress: { gt: after },
      squig: { chainId: 1, contractAddress: SQUIGS_CONTRACT },
    },
    distinct: ['walletAddress'],
    orderBy: { walletAddress: 'asc' },
    select: { walletAddress: true },
    take: limit,
  });
  let created = 0,
    existing = 0,
    conflicts = 0;
  for (const row of rows) {
    const outcome = await db().$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${row.walletAddress}, 0))`;
      const key = { chainId: 1, walletAddress: row.walletAddress };
      if (
        await tx.discoveredWallet.findUnique({
          where: { chainId_walletAddress: key },
        })
      )
        return 'existing';
      const credential = await tx.collectorWallet.findUnique({
        where: { chainId_walletAddress: key },
      });
      if (
        credential?.status === 'REVOKED' ||
        row.walletAddress === '0x0000000000000000000000000000000000000000'
      )
        return 'conflict';
      // Recheck current ownership after selection: a transfer/reorg may have intervened.
      if (
        !(await tx.squigOwnership.findFirst({
          where: {
            isCurrent: true,
            walletAddress: row.walletAddress,
            squig: { chainId: 1, contractAddress: SQUIGS_CONTRACT },
          },
        }))
      )
        return 'conflict';
      if (!dryRun) await discoverHolder(tx, row.walletAddress);
      return 'created';
    });
    if (outcome === 'created') created++;
    else if (outcome === 'existing') existing++;
    else conflicts++;
  }
  return {
    dryRun,
    scanned: rows.length,
    created,
    existing,
    conflicts,
    next: rows.at(-1)?.walletAddress ?? null,
    complete: rows.length < limit,
  };
}

/** Only an empty discovery shell may be absorbed by a freshly proved wallet. */
export async function adoptDiscoveredWallet(
  tx: Prisma.TransactionClient,
  address: string,
  collectorId: string,
) {
  const mapping = await tx.discoveredWallet.findUnique({
    where: { chainId_walletAddress: { chainId: 1, walletAddress: address } },
    include: { collector: true },
  });
  if (!mapping || mapping.collectorId === collectorId) return;
  const source = mapping.collector;
  if (
    source.claimedAt ||
    source.mergedIntoCollectorId ||
    (await tx.collectorWallet.count({ where: { collectorId: source.id } })) ||
    (await tx.externalIdentity.count({ where: { collectorId: source.id } })) ||
    (await tx.dripIdentity.count({ where: { collectorId: source.id } })) ||
    (await tx.collectorActivity.count({ where: { collectorId: source.id } })) ||
    (await tx.squigDiscovery.count({ where: { collectorId: source.id } }))
  )
    throw new Error('IDENTITY_REVIEW_REQUIRED');
  await tx.discoveredWallet.update({
    where: { chainId_walletAddress: { chainId: 1, walletAddress: address } },
    data: { collectorId },
  });
  await tx.collector.update({
    where: { id: source.id },
    data: { isPublic: false, mergedIntoCollectorId: collectorId },
  });
  await tx.operationalAudit.create({
    data: {
      actor: `collector:${collectorId}`,
      action: 'DISCOVERY_CLAIMED',
      subject: source.id,
      detail: { collectorId },
    },
  });
}
