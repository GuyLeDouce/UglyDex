import 'server-only';
import { zeroAddress } from 'viem';
import { db } from '@/server/db';

import { SQUIGS_CONTRACT } from '@/domain/validation';

import type { Prisma } from '@/generated/prisma/client';
export async function observe(
  tx: Prisma.TransactionClient,
  input: {
    tokenId: number;
    wallet: string;
    from?: string;
    block: bigint;
    blockHash: string;
    time: Date;
    key: string;
    source: string;
    txHash?: string;
    logIndex?: number;
  },
) {
  const squig = await tx.squig.upsert({
    where: {
      chainId_contractAddress_tokenId: {
        chainId: 1,
        contractAddress: SQUIGS_CONTRACT,
        tokenId: input.tokenId,
      },
    },
    create: {
      chainId: 1,
      contractAddress: SQUIGS_CONTRACT,
      tokenId: input.tokenId,
    },
    update: {},
  });
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${squig.id}, 0))`;
  const exists = await tx.squigOwnership.findUnique({
    where: { sourceKey: input.key },
  });
  const current = await tx.squigOwnership.findFirst({
    where: { squigId: squig.id, isCurrent: true },
  });
  // ownerOf represents end-of-block state and wins over transfer logs in that same block.
  const isLatest =
    !current ||
    input.block > current.blockNumber ||
    (input.block === current.blockNumber && input.source === 'ownerOf') ||
    (input.block === current.blockNumber &&
      current.source !== 'ownerOf' &&
      (input.logIndex ?? -1) > (current.logIndex ?? -1));
  if (isLatest && !exists)
    await tx.squigOwnership.updateMany({
      where: { squigId: squig.id, isCurrent: true },
      data: { isCurrent: false },
    });
  if (!exists)
    await tx.squigOwnership.create({
      data: {
        squigId: squig.id,
        walletAddress: input.wallet,
        fromWallet: input.from,
        sourceKey: input.key,
        source: input.source,
        blockNumber: input.block,
        blockHash: input.blockHash,
        transactionHash: input.txHash,
        logIndex: input.logIndex,
        acquiredAt:
          input.source === 'transfer'
            ? input.time
            : current?.walletAddress === input.wallet
              ? current.acquiredAt
              : null,
        isCurrent: isLatest,
      },
    });
  if (
    input.source === 'transfer' &&
    current?.source === 'ownerOf' &&
    current.walletAddress === input.wallet &&
    input.block <= current.blockNumber
  ) {
    await tx.squigOwnership.updateMany({
      where: {
        id: current.id,
        OR: [{ acquiredAt: null }, { acquiredAt: { lt: input.time } }],
      },
      data: { acquiredAt: input.time },
    });
  }
  const authoritative = await tx.squigProvenance.findUnique({
    where: { squigId: squig.id },
  });
  for (const address of new Set(
    authoritative
      ? []
      : [
          input.wallet,
          ...(input.source === 'transfer' && input.from ? [input.from] : []),
        ],
  )) {
    if (address === zeroAddress) continue;
    const wallet = await tx.collectorWallet.findUnique({
      where: {
        chainId_walletAddress: { chainId: 1, walletAddress: address },
      },
    });
    // Never retroactively claim all history of a newly signed or reassigned wallet.
    if (
      wallet &&
      wallet.verifiedAt <= input.time &&
      (!wallet.revokedAt || wallet.revokedAt > input.time)
    ) {
      await tx.squigDiscovery.upsert({
        where: {
          collectorId_squigId: {
            collectorId: wallet.collectorId,
            squigId: squig.id,
          },
        },
        create: {
          collectorId: wallet.collectorId,
          squigId: squig.id,
          discoveredAt:
            input.time > wallet.verifiedAt ? input.time : wallet.verifiedAt,
          sourceKey: input.key,
          everOwned: true,
        },
        update: { everOwned: true },
      });
      await tx.squigDiscovery.updateMany({
        where: {
          collectorId: wallet.collectorId,
          squigId: squig.id,
          discoveredAt: { gt: input.time },
        },
        data: {
          discoveredAt:
            input.time > wallet.verifiedAt ? input.time : wallet.verifiedAt,
        },
      });
    }
  }
  if (input.source === 'transfer')
    await tx.squigPassportEvent.upsert({
      where: { eventKey: input.key },
      create: {
        eventKey: input.key,
        squigId: squig.id,
        eventType:
          input.from === zeroAddress
            ? 'MINTED'
            : input.wallet === zeroAddress
              ? 'BURNED'
              : 'TRANSFERRED',
        eventAt: input.time,
        sourceSystem: 'blockchain',
        sourceId: input.key,
        metadata: {
          from: input.from ?? null,
          to: input.wallet,
          transactionHash: input.txHash ?? null,
          blockNumber: input.block.toString(),
        },
      },
      update: {},
    });
  return exists ? ('skipped' as const) : ('inserted' as const);
}
export async function syncOwnership() {
  await db().$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('ownership-refresh',0))`;
    const job = await tx.ownershipRefresh.findUnique({
      where: { id: 'squigs' },
    });
    if (!job) await tx.ownershipRefresh.create({ data: { id: 'squigs' } });
    else if (job.status === 'FAILED')
      await tx.ownershipRefresh.update({
        where: { id: 'squigs' },
        data: { status: 'QUEUED' },
      });
    else if (job.status === 'COMPLETE')
      await tx.ownershipRefresh.update({
        where: { id: 'squigs' },
        data: {
          status: 'QUEUED',
          nextToken: 1,
          blockNumber: null,
          blockHash: null,
          blockTime: null,
          requestedAt: new Date(),
        },
      });
  });
  const { ownershipWorkerBatch } = await import('./ownership-worker');
  while (await ownershipWorkerBatch()) {}
  const job = await db().ownershipRefresh.findUniqueOrThrow({
    where: { id: 'squigs' },
  });
  return {
    scanned: job.nextToken - 1,
    failed: job.status === 'COMPLETE' ? 0 : 1,
  };
}
export { syncTransfers } from './transfers';
