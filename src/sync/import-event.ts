import 'server-only';
import { randomUUID } from 'node:crypto';
import { db } from '@/server/db';
import {
  activitySchema,
  eventKey,
  hash,
  type NormalizedActivity,
} from '@/domain/events';
import { SQUIGS_CONTRACT } from '@/domain/validation';
import { confident } from '@/domain/provenance';
import type { Prisma } from '@/generated/prisma/client';
export async function resolveDiscord(
  tx: Prisma.TransactionClient,
  externalId: string,
) {
  return tx.externalIdentity.upsert({
    where: { provider_externalId: { provider: 'DISCORD', externalId } },
    update: {},
    create: {
      provider: 'DISCORD',
      externalId,
      collector: { create: { slug: `collector-${randomUUID()}` } },
    },
  });
}
export async function resolveActivity(
  tx: Prisma.TransactionClient,
  event: Pick<NormalizedActivity, 'discordId' | 'walletAddress' | 'eventAt'>,
) {
  if (event.discordId)
    return {
      collectorId: (await resolveDiscord(tx, event.discordId)).collectorId,
      attributionStatus: 'DISCORD',
    };
  if (!event.walletAddress)
    return { collectorId: null, attributionStatus: 'UNRESOLVED' };
  const evidence = await tx.historicalIdentityAttribution.findMany({
    where: {
      chainId: 1,
      walletAddress: event.walletAddress,
      effectiveFrom: { lte: event.eventAt },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: event.eventAt } }],
      status: { notIn: ['REJECTED', 'INVALIDATED'] },
    },
  });
  const owners = new Set(evidence.map((e) => e.collectorId)),
    trusted = evidence.find(confident);
  if (owners.size === 1 && trusted)
    return { collectorId: trusted.collectorId, attributionStatus: 'WALLET' };
  if (owners.size > 1)
    await tx.identityReconciliation.upsert({
      where: { dedupeKey: `activity-wallet:${event.walletAddress}` },
      create: {
        dedupeKey: `activity-wallet:${event.walletAddress}`,
        reason: 'ACTIVITY_WALLET_CONFLICT',
        evidence: { wallet: event.walletAddress },
      },
      update: { status: 'PENDING' },
    });
  return {
    collectorId: null,
    attributionStatus: owners.size > 1 ? 'CONFLICT' : 'UNRESOLVED',
  };
}
function snapshot(row: object): Prisma.InputJsonObject {
  return JSON.parse(JSON.stringify(row));
}
async function writeEvent(
  tx: Prisma.TransactionClient,
  raw: NormalizedActivity,
) {
  const event = activitySchema.parse(raw),
    key = eventKey(event),
    payloadHash = hash(event);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key},0))`;
  const attribution = await resolveActivity(tx, event),
    existing = await tx.collectorActivity.findUnique({
      where: { eventKey: key },
    });
  if (
    existing?.payloadHash === payloadHash &&
    existing.collectorId === attribution.collectorId &&
    existing.attributionStatus === attribution.attributionStatus &&
    existing.recordStatus === event.recordStatus
  )
    return 'skipped' as const;
  const squig = event.squigTokenId
    ? await tx.squig.upsert({
        where: {
          chainId_contractAddress_tokenId: {
            chainId: 1,
            contractAddress: SQUIGS_CONTRACT,
            tokenId: event.squigTokenId,
          },
        },
        update: {},
        create: {
          chainId: 1,
          contractAddress: SQUIGS_CONTRACT,
          tokenId: event.squigTokenId,
        },
      })
    : null;
  if (existing)
    await tx.activityCorrection.create({
      data: {
        activityId: existing.id,
        reason:
          existing.payloadHash === payloadHash
            ? 'ATTRIBUTION'
            : 'SOURCE_CORRECTION',
        before: snapshot(existing),
        afterHash: payloadHash,
      },
    });
  const data = {
    ...attribution,
    squigId: squig?.id ?? null,
    sourceSystem: event.sourceSystem,
    sourceType: event.sourceType,
    sourceId: event.sourceId,
    subjectKey:
      event.subject ??
      (event.discordId
        ? `discord:${event.discordId}`
        : event.walletAddress
          ? `wallet:${event.walletAddress}`
          : 'record'),
    eventType: event.eventType,
    eventAt: event.eventAt,
    metadata: event.metadata as Prisma.InputJsonObject,
    payloadHash,
    discordId: event.discordId ?? null,
    walletAddress: event.walletAddress ?? null,
    category: event.category,
    visibility: event.visibility,
    importance: event.importance,
    recordStatus: event.recordStatus,
    amount: event.amount ?? null,
    currency: event.currency ?? null,
    direction: event.direction ?? null,
    sourceCreatedAt: event.sourceCreatedAt ?? null,
    sourceUpdatedAt: event.sourceUpdatedAt ?? null,
    ...(existing ? { correctedAt: new Date() } : {}),
  };
  const activity = await tx.collectorActivity.upsert({
    where: { eventKey: key },
    create: { eventKey: key, ...data },
    update: data,
  });
  await tx.squigPassportEvent.deleteMany({
    where: { activityId: activity.id },
  });
  if (squig && event.recordStatus === 'ACTIVE')
    await tx.squigPassportEvent.create({
      data: {
        eventKey: `${key}:${squig.id}`,
        squigId: squig.id,
        activityId: activity.id,
        eventType: event.eventType,
        eventAt: event.eventAt,
        sourceSystem: event.sourceSystem,
        sourceId: event.sourceId,
        metadata: event.metadata as Prisma.InputJsonObject,
      },
    });
  return existing ? ('updated' as const) : ('inserted' as const);
}
export async function importEvent(raw: NormalizedActivity) {
  return db().$transaction((tx) => writeEvent(tx, raw));
}
// All slots for a source record commit together. Disappearing slots are retracted, never erased.
export async function importRecord(
  sourceType: string,
  sourceId: string,
  events: NormalizedActivity[],
) {
  return db().$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`record:${sourceType}:${sourceId}`},0))`;
    const counts = { inserted: 0, updated: 0, skipped: 0, unresolved: 0 };
    for (const event of events) counts[await writeEvent(tx, event)]++;
    const obsolete = await tx.collectorActivity.findMany({
      where: {
        sourceType,
        sourceId,
        sourceSystem: { in: ['uglybot', 'gauntlet', 'images'] },
        recordStatus: 'ACTIVE',
        eventKey: { notIn: events.map(eventKey) },
      },
    });
    for (const old of obsolete) {
      await tx.activityCorrection.create({
        data: {
          activityId: old.id,
          reason: 'SOURCE_SLOT_RETRACTED',
          before: snapshot(old),
          afterHash: hash('RETRACTED'),
        },
      });
      await tx.collectorActivity.update({
        where: { id: old.id },
        data: { recordStatus: 'RETRACTED', correctedAt: new Date() },
      });
      await tx.squigPassportEvent.deleteMany({ where: { activityId: old.id } });
      counts.updated++;
    }
    counts.unresolved = await tx.collectorActivity.count({
      where: {
        sourceType,
        sourceId,
        recordStatus: 'ACTIVE',
        collectorId: null,
      },
    });
    return counts;
  });
}
export async function reattributeActivity(
  filter: { collectorId?: string; discordId?: string; walletAddress?: string },
  limit = 500,
  options: { after?: string; oneBatch?: boolean } = {},
) {
  let after: string | undefined = options.after,
    updated = 0;
  do {
    const rows = await db().collectorActivity.findMany({
      where: {
        sourceSystem: { in: ['uglybot', 'gauntlet', 'images'] },
        ...(filter.collectorId
          ? {
              OR: [
                { collectorId: filter.collectorId },
                {
                  walletAddress: {
                    in: (
                      await db().historicalIdentityAttribution.findMany({
                        where: { collectorId: filter.collectorId },
                        select: { walletAddress: true },
                      })
                    ).map((e) => e.walletAddress),
                  },
                },
              ],
            }
          : filter),
        ...(after ? { id: { gt: after } } : {}),
      },
      orderBy: { id: 'asc' },
      take: limit,
    });
    for (const row of rows)
      await db().$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${row.eventKey},0))`;
        const current = await tx.collectorActivity.findUniqueOrThrow({
            where: { id: row.id },
          }),
          resolved = await resolveActivity(tx, {
            discordId: current.discordId ?? undefined,
            walletAddress: current.walletAddress ?? undefined,
            eventAt: current.eventAt,
          });
        if (
          current.collectorId === resolved.collectorId &&
          current.attributionStatus === resolved.attributionStatus
        )
          return;
        await tx.activityCorrection.create({
          data: {
            activityId: current.id,
            reason: 'ATTRIBUTION',
            before: snapshot(current),
            afterHash: current.payloadHash,
          },
        });
        await tx.collectorActivity.update({
          where: { id: current.id },
          data: { ...resolved, correctedAt: new Date() },
        });
        updated++;
      });
    after = rows.at(-1)?.id;
    if (rows.length < limit) {
      after = undefined;
      break;
    }
    if (options.oneBatch) break;
  } while (after);
  return { updated, cursor: after };
}
export async function reattributePending() {
  const jobs = await db().activityAttributionJob.findMany({
    orderBy: { queuedAt: 'asc' },
    take: 10,
  });
  for (const job of jobs) {
    const result = await reattributeActivity(
      { walletAddress: job.walletAddress },
      200,
      { after: job.cursor ?? undefined, oneBatch: true },
    );
    if (result.cursor)
      await db().activityAttributionJob.updateMany({
        where: { walletAddress: job.walletAddress, generation: job.generation },
        data: { cursor: result.cursor },
      });
    else
      await db().activityAttributionJob.deleteMany({
        where: { walletAddress: job.walletAddress, generation: job.generation },
      });
  }
  return jobs.length;
}
