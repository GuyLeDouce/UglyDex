import 'server-only';
import { createHash } from 'node:crypto';
import { db } from '@/server/db';
import type { Prisma } from '@/generated/prisma/client';
import {
  deriveWalletPeriods,
  deriveCollectorPeriods,
  holdingEventTypes,
} from '@/domain/provenance';
import { SQUIGS_CONTRACT } from '@/domain/validation';
const key = (parts: unknown[]) =>
  createHash('sha256').update(JSON.stringify(parts)).digest('hex');
export const chainKey = `transfers:1:${SQUIGS_CONTRACT}`;

export async function markWalletDirty(
  tx: Prisma.TransactionClient,
  address: string,
) {
  await tx.activityAttributionJob.upsert({
    where: { walletAddress: address },
    create: { walletAddress: address },
    update: {
      generation: { increment: 1 },
      cursor: null,
      queuedAt: new Date(),
    },
  });
  const rows = await tx.walletOwnershipPeriod.findMany({
    where: { walletAddress: address },
    select: { squigId: true },
    distinct: ['squigId'],
  });
  await tx.squigProvenance.updateMany({
    where: { squigId: { in: rows.map((r) => r.squigId) } },
    data: { dirty: true },
  });
}
// Backfills Phase 1 credentials as dated evidence, never before verifiedAt.
export async function seedAttributions() {
  let after: string | undefined;
  while (true) {
    const wallets = await db().collectorWallet.findMany({
      where: { chainId: 1 },
      orderBy: { id: 'asc' },
      take: 100,
      ...(after ? { cursor: { id: after }, skip: 1 } : {}),
    });
    for (const w of wallets)
      await db().$transaction(async (tx) => {
        const sourceKey = `credential:${w.id}`;
        const exists = await tx.historicalIdentityAttribution.findUnique({
          where: { sourceKey },
          select: { id: true },
        });
        await tx.historicalIdentityAttribution.upsert({
          where: { sourceKey },
          create: {
            sourceKey,
            collectorId: w.collectorId,
            walletAddress: w.walletAddress,
            source: w.source,
            status: w.revokedAt ? 'REVOKED' : 'VERIFIED',
            confidence: 'SIGNED',
            effectiveFrom: w.verifiedAt,
            effectiveTo: w.revokedAt,
            evidence: { walletId: w.id },
          },
          update: {},
        });
        if (!exists) await markWalletDirty(tx, w.walletAddress);
      });
    if (wallets.length < 100) break;
    after = wallets.at(-1)!.id;
  }
  let legacyAfter: string | undefined;
  while (true) {
    const legacy = await db().walletLinkEvidence.findMany({
      where: { legacyVerified: true },
      orderBy: { id: 'asc' },
      take: 100,
      ...(legacyAfter ? { cursor: { id: legacyAfter }, skip: 1 } : {}),
    });
    for (const e of legacy) {
      const identity = await db().externalIdentity.findUnique({
        where: {
          provider_externalId: { provider: 'DISCORD', externalId: e.discordId },
        },
      });
      if (!identity) continue;
      await db().$transaction(async (tx) => {
        const exists = await tx.historicalIdentityAttribution.findUnique({
          where: { sourceKey: `legacy:${e.sourceKey}` },
          select: { id: true },
        });
        const attribution = await tx.historicalIdentityAttribution.upsert({
          where: { sourceKey: `legacy:${e.sourceKey}` },
          create: {
            sourceKey: `legacy:${e.sourceKey}`,
            collectorId: identity.collectorId,
            walletAddress: e.walletAddress,
            source: 'UGLYBOT',
            status: 'UNCONFIRMED',
            confidence: 'LEGACY',
            effectiveFrom: e.sourceCreatedAt ?? e.observedAt,
            effectiveTo: null,
            evidence: {
              evidenceId: e.id,
              dateIsObservation: !e.sourceCreatedAt,
            },
          },
          update: {},
        });
        await tx.identityReconciliation.upsert({
          where: { dedupeKey: `attribution:${attribution.id}` },
          create: {
            dedupeKey: `attribution:${attribution.id}`,
            reason: 'HISTORICAL_ATTRIBUTION_REVIEW',
            evidence: { attributionId: attribution.id },
          },
          update: {},
        });
        if (!exists) await markWalletDirty(tx, e.walletAddress);
      });
    }
    if (legacy.length < 100) break;
    legacyAfter = legacy.at(-1)!.id;
  }
}

export async function deriveToken(squigId: string) {
  return db().$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${squigId},0))`;
      const facts = await tx.nftTransfer.findMany({
        where: { squigId },
        orderBy: [{ blockNumber: 'asc' }, { logIndex: 'asc' }],
      });
      const result = deriveWalletPeriods(facts);
      const cursor = await tx.chainCursor.findUnique({
        where: { key: chainKey },
      });
      const at = cursor
        ? await tx.chainBlock.findUnique({
            where: {
              chainId_number: { chainId: 1, number: cursor.blockNumber },
            },
          })
        : null;
      const evidence = await tx.historicalIdentityAttribution.findMany({
        where: {
          chainId: 1,
          ...(at ? { effectiveFrom: { lte: at.timestamp } } : {}),
          walletAddress: {
            in: [...new Set(result.periods.map((p) => p.walletAddress))],
          },
        },
      });
      const attributed = deriveCollectorPeriods(
        result.periods,
        evidence.map((e) => ({
          ...e,
          effectiveTo:
            at && e.effectiveTo && e.effectiveTo > at.timestamp
              ? null
              : e.effectiveTo,
        })),
      );
      const old = await tx.collectorOwnershipPeriod.findMany({
        where: { squigId },
        select: { collectorId: true },
      });
      const discoveries = await tx.squigDiscovery.findMany({
        where: {
          squigId,
          ...(at
            ? { discoveredAt: { lte: at.timestamp } }
            : { sourceKey: 'provenance' }),
        },
        select: { collectorId: true },
      });
      await tx.walletOwnershipPeriod.deleteMany({ where: { squigId } });
      await tx.collectorOwnershipPeriod.deleteMany({ where: { squigId } });
      // Broken raw continuity is displayed as an anomaly, never as a confident hold.
      const trusted = result.issues.length === 0;
      if (trusted && result.periods.length)
        await tx.walletOwnershipPeriod.createMany({
          data: result.periods.map((p) => ({ ...p, squigId })),
        });
      const periods = trusted
        ? attributed.periods.map((p) => ({
            ...p,
            squigId,
            id: key([squigId, p.collectorId, p.acquiredAt, p.acquisitionEvent]),
          }))
        : [];
      if (periods.length)
        await tx.collectorOwnershipPeriod.createMany({ data: periods });
      for (const wallet of attributed.conflicts)
        await tx.identityReconciliation.upsert({
          where: { dedupeKey: `history-conflict:${wallet}` },
          create: {
            dedupeKey: `history-conflict:${wallet}`,
            reason: 'OVERLAPPING_ATTRIBUTION',
            evidence: { wallet },
          },
          update: { status: 'PENDING', resolvedAt: null },
        });
      const collectors = new Set([
        ...old.map((p) => p.collectorId),
        ...discoveries.map((p) => p.collectorId),
        ...periods.map((p) => p.collectorId),
      ]);
      for (const collectorId of collectors) {
        const held = periods.filter((p) => p.collectorId === collectorId),
          first = held[0];
        if (first)
          await tx.squigDiscovery.upsert({
            where: { collectorId_squigId: { collectorId, squigId } },
            create: {
              collectorId,
              squigId,
              discoveredAt: first.acquiredAt,
              sourceKey: 'provenance',
              everOwned: true,
              attributionStatus: 'CONFIRMED',
              firstOwnershipPeriod: first.id,
            },
            update: {
              discoveredAt: first.acquiredAt,
              sourceKey: 'provenance',
              everOwned: true,
              attributionStatus: 'CONFIRMED',
              firstOwnershipPeriod: first.id,
            },
          });
        else
          await tx.squigDiscovery.updateMany({
            where: {
              collectorId,
              squigId,
              ...(at
                ? { discoveredAt: { lte: at.timestamp } }
                : { sourceKey: 'provenance' }),
            },
            data: {
              everOwned: false,
              attributionStatus: 'INVALIDATED',
              firstOwnershipPeriod: null,
            },
          });
      }
      // Rebuild only this projection's timeline, leaving ecosystem activity untouched.
      await tx.collectorActivity.deleteMany({
        where: { squigId, sourceSystem: 'provenance' },
      });
      for (const p of periods) {
        const types = holdingEventTypes(
          p === periods.find((v) => v.collectorId === p.collectorId),
          p.acquiredAt,
          p.lostAt,
          facts.find((f) => f.id === p.acquisitionEvent)?.eventAt,
          facts.find((f) => f.id === p.lossEvent)?.eventAt,
        );
        const events = [
          {
            type: types.acquired,
            at: p.acquiredAt,
          },
          ...(p.lostAt ? [{ type: types.lost, at: p.lostAt }] : []),
        ];
        const firstIndex = facts.findIndex((f) => f.id === p.acquisitionEvent),
          lastIndex = p.lossEvent
            ? facts.findIndex((f) => f.id === p.lossEvent)
            : -1;
        for (const [index, f] of facts.entries())
          if (
            f.fromAddress !== f.toAddress &&
            index > firstIndex &&
            (lastIndex < 0 || index < lastIndex) &&
            f.eventAt >= p.acquiredAt &&
            (!p.lostAt || f.eventAt <= p.lostAt) &&
            p.walletAddresses.includes(f.fromAddress) &&
            p.walletAddresses.includes(f.toAddress)
          )
            events.push({ type: 'WALLET_MOVE', at: f.eventAt });
        for (const [i, e] of events.entries()) {
          const eventKey = key([p.id, e.type, e.at, i]);
          await tx.collectorActivity.create({
            data: {
              eventKey,
              collectorId: p.collectorId,
              squigId,
              sourceSystem: 'provenance',
              category: 'SQUIGS',
              visibility: 'PUBLIC',
              sourceType: 'ownership',
              sourceId: eventKey,
              subjectKey: p.collectorId,
              eventType: e.type,
              eventAt: e.at,
              metadata: { tokenId: facts[0]?.tokenId },
              payloadHash: eventKey,
            },
          });
        }
      }
      const last = facts.at(-1);
      const longest =
        trusted && result.periods.length
          ? Math.max(
              ...result.periods.map((p) =>
                Math.max(
                  0,
                  ((p.lostAt ?? at?.timestamp ?? p.acquiredAt).getTime() -
                    p.acquiredAt.getTime()) /
                    1000,
                ),
              ),
            )
          : null;
      await tx.squigProvenance.upsert({
        where: { squigId },
        create: { squigId },
        update: {},
      });
      await tx.squigProvenance.update({
        where: { squigId },
        data: {
          dirty: false,
          complete: trusted,
          issues: result.issues,
          mintAt: result.mint?.eventAt ?? null,
          minter: result.mint?.toAddress ?? null,
          mintTransaction:
            facts.find((f) => f.id === result.mint?.id)?.transactionHash ??
            null,
          mintBlock: result.mint?.blockNumber ?? null,
          currentWallet: trusted ? result.currentWallet : null,
          currentSince: trusted
            ? (result.periods.find((p) => !p.lostAt)?.acquiredAt ?? null)
            : null,
          transferCount: facts.filter(
            (f) =>
              f.fromAddress !== '0x0000000000000000000000000000000000000000',
          ).length,
          uniqueWallets: new Set(result.periods.map((p) => p.walletAddress))
            .size,
          longestHoldSeconds:
            longest === null ? null : BigInt(Math.floor(longest)),
          derivedThrough: cursor?.blockNumber ?? last?.blockNumber,
          ownerMatches: null,
          verifiedAt: null,
        },
      });
      // Compatibility read model for Phase 1: newer finalized ownerOf snapshots win.
      const snapshot = await tx.squigOwnership.findFirst({
        where: { squigId, source: 'ownerOf' },
        orderBy: { blockNumber: 'desc' },
      });
      await tx.squigOwnership.updateMany({
        where: { squigId, isCurrent: true },
        data: { isCurrent: false },
      });
      if (snapshot && (!last || snapshot.blockNumber > last.blockNumber))
        await tx.squigOwnership.update({
          where: { id: snapshot.id },
          data: {
            isCurrent: true,
            acquiredAt:
              trusted && snapshot.walletAddress === result.currentWallet
                ? result.periods.find((p) => !p.lostAt)?.acquiredAt
                : null,
          },
        });
      else if (last && trusted && result.currentWallet)
        await tx.squigOwnership.upsert({
          where: { sourceKey: `ledger:${last.id}` },
          create: {
            squigId,
            sourceKey: `ledger:${last.id}`,
            source: 'ledger',
            walletAddress: result.currentWallet,
            blockNumber: last.blockNumber,
            blockHash: last.blockHash,
            transactionHash: last.transactionHash,
            logIndex: last.logIndex,
            acquiredAt: result.periods.find((p) => !p.lostAt)?.acquiredAt,
            isCurrent: true,
          },
          update: {
            isCurrent: true,
            acquiredAt: result.periods.find((p) => !p.lostAt)?.acquiredAt,
          },
        });
      return {
        tokenId: facts[0]?.tokenId,
        issues: result.issues,
        periods: periods.length,
      };
    },
    { timeout: 60000 },
  );
}
export async function derivePending(limit = 100) {
  const rows = await db().squigProvenance.findMany({
    where: { dirty: true },
    take: limit,
    orderBy: { squigId: 'asc' },
  });
  for (const row of rows) await deriveToken(row.squigId);
  return rows.length;
}
