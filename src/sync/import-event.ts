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
export async function importEvent(
  raw: NormalizedActivity,
): Promise<'inserted' | 'updated' | 'skipped'> {
  const event = activitySchema.parse(raw);
  const key = eventKey(event),
    payloadHash = hash(event);
  return db().$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
    const identity = await resolveDiscord(tx, event.discordId);
    const existing = await tx.collectorActivity.findUnique({
      where: { eventKey: key },
    });
    if (
      existing?.payloadHash === payloadHash &&
      existing.collectorId === identity.collectorId
    )
      return 'skipped';
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
    const data = {
      collectorId: identity.collectorId,
      squigId: squig?.id ?? null,
      sourceSystem: event.sourceSystem,
      sourceType: event.sourceType,
      sourceId: event.sourceId,
      subjectKey: `discord:${event.discordId}`,
      eventType: event.eventType,
      eventAt: event.eventAt,
      metadata: event.metadata as Prisma.InputJsonObject,
      payloadHash,
    };
    const activity = await tx.collectorActivity.upsert({
      where: { eventKey: key },
      create: { eventKey: key, ...data },
      update: data,
    });
    // Replace only this event's derived association when corrected, never historical unrelated events.
    await tx.squigPassportEvent.deleteMany({
      where: {
        activityId: activity.id,
        ...(squig ? { squigId: { not: squig.id } } : {}),
      },
    });
    if (squig) {
      const passport = {
        squigId: squig.id,
        activityId: activity.id,
        eventType: event.eventType,
        eventAt: event.eventAt,
        sourceSystem: event.sourceSystem,
        sourceId: event.sourceId,
        metadata: event.metadata as Prisma.InputJsonObject,
      };
      await tx.squigPassportEvent.upsert({
        where: { eventKey: `${key}:${squig.id}` },
        create: { eventKey: `${key}:${squig.id}`, ...passport },
        update: passport,
      });
    }
    return existing ? 'updated' : 'inserted';
  });
}
