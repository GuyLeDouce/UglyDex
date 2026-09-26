import 'server-only';
import { db } from './db';
import {
  cosmeticCatalog,
  COSMETIC_VERSION,
  resolveAppearance,
  appearanceSchema,
} from '@/domain/cosmetics';
import { RULESET } from '@/domain/progression';
import { COLLECTION_RULESET } from '@/domain/dex';
import { activeAddresses, ownedScope, catalogScope } from './collections';
export async function seedCosmetics() {
  await db().$transaction(
    cosmeticCatalog.map((c) =>
      db().cosmeticDefinition.upsert({
        where: { id: c.id },
        create: {
          id: c.id,
          catalogVersion: COSMETIC_VERSION,
          kind: c.kind,
          name: c.name,
          source: c.source,
        },
        update: {},
      }),
    ),
  );
}
export async function cosmeticAvailability(collectorId: string) {
  const [
    achievement,
    set,
    owned,
    definitions,
    progressPending,
    collectionPending,
  ] = await Promise.all([
    db().collectorAchievement.count({
      where: {
        collectorId,
        awardedAt: { not: null },
        revokedAt: null,
        gateSatisfied: true,
        achievement: { ruleset: RULESET },
      },
    }),
    db().collectorSetProgress.count({
      where: {
        collectorId,
        currentlyComplete: true,
        set: { ruleset: COLLECTION_RULESET, enabled: true },
      },
    }),
    db().squig.findMany({
      where: {
        AND: [
          catalogScope,
          ownedScope(await activeAddresses(collectorId)),
          { NOT: { provenance: { is: { dirty: true } } } },
        ],
      },
      select: { og: true, legendary: true },
    }),
    db().cosmeticDefinition.findMany({
      select: { id: true, enabled: true, catalogVersion: true },
    }),
    db().progressionJob.count({
      where: { subjectType: 'COLLECTOR', subjectId: collectorId },
    }),
    db().collectionJob.count({ where: { collectorId } }),
  ]);
  const grants = {
    FREE: true,
    ACHIEVEMENT: achievement > 0 && !progressPending,
    SET: set > 0 && !collectionPending,
    OG: owned.some((s) => s.og),
    LEGENDARY: owned.some((s) => s.legendary),
  };
  return cosmeticCatalog
    .filter(
      (c) =>
        grants[c.source] &&
        !definitions.some(
          (d) =>
            d.id === c.id &&
            (!d.enabled || d.catalogVersion !== COSMETIC_VERSION),
        ),
    )
    .map((c) => c.id);
}
export async function appearance(collectorId: string) {
  const [preferences, unlocked] = await Promise.all([
    db().collectorCosmeticPreference.findMany({
      where: { collectorId },
      select: { kind: true, cosmeticId: true },
    }),
    cosmeticAvailability(collectorId),
  ]);
  return resolveAppearance(preferences, unlocked);
}
export async function saveAppearance(collectorId: string, input: unknown) {
  const values = appearanceSchema.parse(input);
  await seedCosmetics();
  const unlocked = await cosmeticAvailability(collectorId);
  if (
    Object.entries(values).some(
      ([kind, id]) =>
        !unlocked.includes(id) ||
        !cosmeticCatalog.some((c) => c.kind === kind && c.id === id),
    )
  )
    throw new Error('COSMETIC_LOCKED');
  await db().$transaction(async (tx) => {
    for (const c of cosmeticCatalog) {
      if (unlocked.includes(c.id))
        await tx.cosmeticEntitlement.upsert({
          where: { collectorId_cosmeticId: { collectorId, cosmeticId: c.id } },
          create: { collectorId, cosmeticId: c.id, source: c.source },
          update: { revokedAt: null },
        });
      else
        await tx.cosmeticEntitlement.updateMany({
          where: { collectorId, cosmeticId: c.id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
    }
    for (const [kind, cosmeticId] of Object.entries(values))
      await tx.collectorCosmeticPreference.upsert({
        where: { collectorId_kind: { collectorId, kind } },
        create: { collectorId, kind, cosmeticId },
        update: { cosmeticId },
      });
  });
}
