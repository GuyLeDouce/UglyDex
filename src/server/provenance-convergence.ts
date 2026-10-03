import 'server-only';
import { createHash } from 'node:crypto';
import type { Prisma } from '@/generated/prisma/client';
import {
  deriveWalletPeriods,
  deriveCollectorPeriods,
} from '@/domain/provenance';
import { hash } from '@/domain/events';
import { chainKey } from '@/sync/provenance';
import type { Check } from '@/domain/operations';
import { provenanceActivities } from './provenance-semantics';

// Reuse the chain/attribution engines without updating projections or verification clocks.
export async function verifyProvenanceConvergence(
  tx: Prisma.TransactionClient,
): Promise<Check[]> {
  let failures = 0,
    subjects = 0;
  const discrepancies = {
    missingProjections: 0,
    collectorPeriods: 0,
    walletPeriods: 0,
    provenanceFields: 0,
    longestHold: 0,
    discoveryMissing: 0,
    discoveryUnexpected: 0,
    ownershipActivity: 0,
  };
  discrepancies.missingProjections = await tx.squig.count({
    where: { transfers: { some: {} }, provenance: { is: null } },
  });
  failures += discrepancies.missingProjections;
  const cursor = await tx.chainCursor.findUnique({ where: { key: chainKey } });
  const at =
    cursor &&
    (await tx.chainBlock.findUnique({
      where: { chainId_number: { chainId: 1, number: cursor.blockNumber } },
    }));
  let after: string | undefined;
  do {
    const squigs = await tx.squigProvenance.findMany({
      where: after ? { squigId: { gt: after } } : {},
      orderBy: { squigId: 'asc' },
      take: 100,
    });
    for (const stored of squigs) {
      subjects++;
      const squigId = stored.squigId;
      const facts = await tx.nftTransfer.findMany({
        where: { squigId },
        orderBy: [{ blockNumber: 'asc' }, { logIndex: 'asc' }],
      });
      const result = deriveWalletPeriods(facts);
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
      const trusted = result.issues.length === 0;
      const expected = trusted
        ? attributed.periods.map((p) => ({
            ...p,
            squigId,
            id: createHash('sha256')
              .update(
                JSON.stringify([
                  squigId,
                  p.collectorId,
                  p.acquiredAt,
                  p.acquisitionEvent,
                ]),
              )
              .digest('hex'),
          }))
        : [];
      const actual = await tx.collectorOwnershipPeriod.findMany({
        where: { squigId },
      });
      // Evidence ordering is set-like; array membership remains fully checked.
      const normalize = (p: (typeof expected)[number]) => ({
        ...p,
        evidenceIds: [...p.evidenceIds].sort(),
        walletAddresses: [...p.walletAddresses].sort(),
      });
      const sorted = (rows: { id: string }[]) =>
        [...rows].sort((a, b) => a.id.localeCompare(b.id));
      if (
        hash(sorted(actual.map(normalize))) !==
        hash(sorted(expected.map(normalize)))
      ) {
        failures++;
        discrepancies.collectorPeriods++;
      }
      const expectedActivity = provenanceActivities(
        squigId,
        expected,
        facts,
      ).map((a) => ({
        ...a,
        attributionStatus: 'RESOLVED',
        recordStatus: 'ACTIVE',
        importance: 'STANDARD',
        discordId: null,
        walletAddress: null,
        amount: null,
        currency: null,
        direction: null,
        sourceCreatedAt: null,
        sourceUpdatedAt: null,
      }));
      const actualActivity = await tx.collectorActivity.findMany({
        where: { squigId, sourceSystem: 'provenance' },
        select: {
          eventKey: true,
          collectorId: true,
          squigId: true,
          sourceSystem: true,
          category: true,
          visibility: true,
          sourceType: true,
          sourceId: true,
          subjectKey: true,
          eventType: true,
          eventAt: true,
          metadata: true,
          payloadHash: true,
          attributionStatus: true,
          recordStatus: true,
          importance: true,
          discordId: true,
          walletAddress: true,
          amount: true,
          currency: true,
          direction: true,
          sourceCreatedAt: true,
          sourceUpdatedAt: true,
        },
      });
      const activityOrder = (rows: { eventKey: string }[]) =>
        [...rows].sort((a, b) => a.eventKey.localeCompare(b.eventKey));
      if (
        hash(activityOrder(actualActivity)) !==
        hash(activityOrder(expectedActivity))
      ) {
        failures++;
        discrepancies.ownershipActivity++;
      }
      const wallets = await tx.walletOwnershipPeriod.findMany({
        where: { squigId },
      });
      if (
        hash(sorted(wallets)) !==
        hash(
          sorted(trusted ? result.periods.map((p) => ({ ...p, squigId })) : []),
        )
      ) {
        failures++;
        discrepancies.walletPeriods++;
      }
      if (
        stored.dirty ||
        stored.complete !== trusted ||
        hash(stored.issues) !== hash(result.issues) ||
        stored.mintAt?.toISOString() !== result.mint?.eventAt.toISOString() ||
        stored.minter !== (result.mint?.toAddress ?? null) ||
        stored.mintBlock !== (result.mint?.blockNumber ?? null) ||
        stored.mintTransaction !==
          (facts.find((f) => f.id === result.mint?.id)?.transactionHash ??
            null) ||
        stored.currentWallet !== (trusted ? result.currentWallet : null) ||
        (stored.currentSince?.toISOString() ?? null) !==
          (trusted
            ? (result.periods
                .find((p) => !p.lostAt)
                ?.acquiredAt.toISOString() ?? null)
            : null) ||
        stored.transferCount !==
          facts.filter(
            (f) =>
              f.fromAddress !== '0x0000000000000000000000000000000000000000',
          ).length ||
        stored.uniqueWallets !==
          new Set(result.periods.map((p) => p.walletAddress)).size
      ) {
        failures++;
        discrepancies.provenanceFields++;
      }
      // longestHoldSeconds is a projection at derivedThrough, not the latest moving chain cursor.
      const derivationBlock =
        stored.derivedThrough === null
          ? null
          : await tx.chainBlock.findUnique({
              where: {
                chainId_number: { chainId: 1, number: stored.derivedThrough },
              },
            });
      const longest =
        trusted && result.periods.length
          ? BigInt(
              Math.floor(
                Math.max(
                  ...result.periods.map((p) =>
                    Math.max(
                      0,
                      ((
                        p.lostAt ??
                        derivationBlock?.timestamp ??
                        p.acquiredAt
                      ).getTime() -
                        p.acquiredAt.getTime()) /
                        1000,
                    ),
                  ),
                ),
              ),
            )
          : null;
      if (stored.longestHoldSeconds !== longest) {
        failures++;
        discrepancies.longestHold++;
      }
      const discoveries = await tx.squigDiscovery.findMany({
        where: { squigId },
      });
      const first = new Map<string, (typeof expected)[number]>();
      for (const p of expected)
        if (!first.has(p.collectorId)) first.set(p.collectorId, p);
      for (const [collectorId, p] of first) {
        const d = discoveries.find((d) => d.collectorId === collectorId);
        if (
          !d ||
          !d.everOwned ||
          d.attributionStatus !== 'CONFIRMED' ||
          d.firstOwnershipPeriod !== p.id ||
          d.sourceKey !== 'provenance' ||
          +d.discoveredAt !== +p.acquiredAt
        ) {
          failures++;
          discrepancies.discoveryMissing++;
        }
      }
      for (const d of discoveries)
        if (
          d.attributionStatus === 'CONFIRMED' &&
          !first.has(d.collectorId) &&
          (at ? d.discoveredAt <= at.timestamp : d.sourceKey === 'provenance')
        ) {
          failures++;
          discrepancies.discoveryUnexpected++;
        }
    }
    after = squigs.length === 100 ? squigs.at(-1)!.squigId : undefined;
  } while (after);
  return [
    {
      name: 'provenance.recomputation',
      status: failures ? 'FAIL' : 'PASS',
      detail: `${failures} discrepancies; ${subjects} immutable ledgers and attribution projections recomputed; ${JSON.stringify(discrepancies)}`,
    },
  ];
}
