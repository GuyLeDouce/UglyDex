import 'server-only';
import { db } from './db';
import { Prisma } from '@/generated/prisma/client';
import {
  collectibleManifest,
  collectibleImageUrl,
  type CustomInput,
  type EditionInput,
} from '@/domain/collectibles';
import { inspectCollectibleArtwork } from './collectible-art';
import { hash } from '@/domain/events';
import { activeAddresses, ownedScope, catalogScope } from './collections';
const json = (v: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(v));
const artworkSelect = {
  uri: true,
  sha256: true,
  width: true,
  height: true,
} as const;
export const customPublicSelect = {
  id: true,
  key: true,
  name: true,
  description: true,
  artist: true,
  issuedAt: true,
  verifiedAt: true,
  artwork: { select: artworkSelect },
} as const;

// All manifest rows, relations and artwork validate before a single catalog write.
export async function importCollectibles(
  input: unknown,
  actor: string,
  inspect = inspectCollectibleArtwork,
) {
  const manifest = collectibleManifest.parse(input);
  const keys = manifest.records.map((r) => ('key' in r ? r.key : r.slug));
  if (new Set(keys).size !== keys.length)
    throw new Error('DUPLICATE_MANIFEST_KEY');
  const tokens = [
    ...new Set(
      manifest.records.flatMap((r) =>
        'key' in r ? [r.tokenId] : r.relatedTokens,
      ),
    ),
  ];
  const squigs = await db().squig.findMany({
    where: { ...catalogScope, tokenId: { in: tokens } },
    select: { id: true, tokenId: true },
  });
  if (squigs.length !== tokens.length) throw new Error('UNKNOWN_SQUIG');
  const assets = new Map<string, Awaited<ReturnType<typeof inspect>>>();
  for (const uri of new Set(manifest.records.map((r) => r.imageUri)))
    assets.set(uri, await inspect(uri));
  return db().$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('collectibles:catalog',0))`;
      for (const a of assets.values()) {
        const { bytes: _bytes, ...data } = a;
        void _bytes;
        const prior = await tx.collectibleArtwork.findUnique({
          where: { id: a.id },
        });
        if (prior && prior.sha256 !== a.sha256)
          throw new Error('IMMUTABLE_ARTWORK_CHANGED');
        await tx.collectibleArtwork.upsert({
          where: { id: a.id },
          create: data,
          update: { validatedAt: new Date() },
        });
      }
      let created = 0,
        updated = 0,
        unchanged = 0;
      for (const record of manifest.records) {
        const custom = manifest.kind === 'CUSTOM';
        const c = record as CustomInput,
          e = record as EditionInput;
        const old = custom
          ? await tx.squigCustom.findUnique({ where: { key: c.key } })
          : await tx.squigEdition.findUnique({ where: { slug: e.slug } });
        const common = {
          name: record.name,
          description: record.description,
          artist: record.artist,
          issuedAt: record.issuedAt ? new Date(record.issuedAt) : null,
          source: record.source,
          sourceReference: record.sourceReference,
          status: record.status,
          artworkId: assets.get(record.imageUri)!.id,
        };
        const data = custom
          ? {
              ...common,
              key: c.key,
              squigId: squigs.find((s) => s.tokenId === c.tokenId)!.id,
              sortOrder: c.sortOrder,
            }
          : {
              ...common,
              slug: e.slug,
              supply: e.supply,
              standard: e.standard,
              chainId: e.chainId,
              contractAddress: e.contractAddress,
              tokenId: e.tokenId,
            };
        const relations =
          custom || !old
            ? []
            : await tx.squigEditionRelation.findMany({
                where: { editionId: old.id },
                select: { squigId: true },
              });
        const same =
          old &&
          Object.entries(data).every(
            ([k, v]) =>
              hash((old as unknown as Record<string, unknown>)[k]) === hash(v),
          ) &&
          (custom ||
            relations
              .map((r) => r.squigId)
              .sort()
              .join() ===
              e.relatedTokens
                .map((t) => squigs.find((s) => s.tokenId === t)!.id)
                .sort()
                .join());
        if (same) {
          unchanged++;
          continue;
        }
        if (old && record.revision !== old.revision)
          throw new Error('EDIT_CONFLICT');
        if (old?.status === 'RETIRED' && record.status !== 'RETIRED')
          throw new Error('RETIRED_RECORD_IMMUTABLE');
        if (
          old &&
          custom &&
          'squigId' in old &&
          old.squigId !== squigs.find((s) => s.tokenId === c.tokenId)!.id
        )
          throw new Error('CUSTOM_TOKEN_IMMUTABLE');
        const verifiedAt =
          record.status === 'VERIFIED'
            ? (old?.verifiedAt ?? new Date())
            : (old?.verifiedAt ?? null);
        const saved = custom
          ? await tx.squigCustom.upsert({
              where: { key: c.key },
              create: {
                ...common,
                key: c.key,
                squigId: squigs.find((s) => s.tokenId === c.tokenId)!.id,
                sortOrder: c.sortOrder,
                verifiedAt,
              },
              update: {
                ...common,
                sortOrder: c.sortOrder,
                verifiedAt,
                revision: { increment: 1 },
              },
            })
          : await tx.squigEdition.upsert({
              where: { slug: e.slug },
              create: {
                ...common,
                slug: e.slug,
                supply: e.supply,
                standard: e.standard,
                chainId: e.chainId,
                contractAddress: e.contractAddress,
                tokenId: e.tokenId,
                verifiedAt,
              },
              update: {
                ...common,
                supply: e.supply,
                standard: e.standard,
                chainId: e.chainId,
                contractAddress: e.contractAddress,
                tokenId: e.tokenId,
                verifiedAt,
                revision: { increment: 1 },
              },
            });
        if (!custom) {
          await tx.squigEditionRelation.deleteMany({
            where: { editionId: saved.id },
          });
          await tx.squigEditionRelation.createMany({
            data: e.relatedTokens.map((t) => ({
              editionId: saved.id,
              squigId: squigs.find((s) => s.tokenId === t)!.id,
            })),
          });
        }
        await tx.collectibleAudit.create({
          data: {
            kind: manifest.kind,
            entityId: saved.id,
            actor,
            action: !old
              ? 'CREATED'
              : old.status !== record.status
                ? record.status
                : 'EDITED',
            snapshot: json({
              before: old,
              after: saved,
              relatedTokens: custom ? [c.tokenId] : e.relatedTokens,
              artwork: {
                uri: record.imageUri,
                sha256: assets.get(record.imageUri)!.sha256,
              },
            }),
          },
        });
        if (custom && record.status === 'VERIFIED' && !old?.verifiedAt) {
          await tx.squigPassportEvent.upsert({
            where: { eventKey: `custom:verified:${saved.id}` },
            update: {},
            create: {
              eventKey: `custom:verified:${saved.id}`,
              squigId: squigs.find((s) => s.tokenId === c.tokenId)!.id,
              eventType: 'CUSTOM_VERIFIED',
              eventAt: verifiedAt!,
              sourceSystem: 'uglydex',
              sourceId: saved.id,
              metadata: { customKey: c.key },
            },
          });
        }
        if (old) updated++;
        else created++;
      }
      return { created, updated, unchanged };
    },
    { timeout: 60000 },
  );
}

export async function publicCustoms(tokenId: number) {
  const rows = await db().squigCustom.findMany({
    where: { status: 'VERIFIED', squig: { ...catalogScope, tokenId } },
    orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }],
    select: customPublicSelect,
  });
  return rows.map((c) => ({
    key: c.key,
    name: c.name,
    description: c.description,
    artist: c.artist,
    issuedAt: c.issuedAt?.toISOString() ?? null,
    verifiedAt: c.verifiedAt?.toISOString() ?? null,
    image: collectibleImageUrl(c.artwork.uri),
  }));
}

export async function ownedSquig(collectorId: string, tokenId: number) {
  return db().squig.findFirst({
    where: {
      AND: [
        catalogScope,
        { tokenId },
        ownedScope(await activeAddresses(collectorId)),
        { NOT: { provenance: { is: { dirty: true } } } },
      ],
    },
    select: {
      id: true,
      ownerships: {
        where: { isCurrent: true },
        select: { sourceKey: true, walletAddress: true },
        take: 1,
      },
    },
  });
}
export async function saveDisplayPreference(
  collectorId: string,
  tokenId: number,
  key: string | null,
) {
  const squig = await ownedSquig(collectorId, tokenId);
  if (!squig?.ownerships[0]) throw new Error('CURRENT_OWNER_REQUIRED');
  const custom = key
    ? await db().squigCustom.findFirst({
        where: { key, squigId: squig.id, status: 'VERIFIED' },
        select: { id: true },
      })
    : null;
  if (key && !custom) throw new Error('CUSTOM_UNAVAILABLE');
  await db().squigDisplayPreference.upsert({
    where: { collectorId_squigId: { collectorId, squigId: squig.id } },
    create: {
      collectorId,
      squigId: squig.id,
      customId: custom?.id,
      ownershipKey: squig.ownerships[0].sourceKey,
    },
    update: {
      customId: custom?.id ?? null,
      ownershipKey: squig.ownerships[0].sourceKey,
    },
  });
}

// Owner-specific projection; preferences never follow a transfer or reveal owner identity.
export async function displayCustom(collectorId: string, tokenId: number) {
  const squig = await ownedSquig(collectorId, tokenId);
  if (!squig?.ownerships[0]) return null;
  const p = await db().squigDisplayPreference.findUnique({
    where: { collectorId_squigId: { collectorId, squigId: squig.id } },
    include: { custom: { include: { artwork: true } } },
  });
  if (
    !p?.custom ||
    p.custom.status !== 'VERIFIED' ||
    p.custom.squigId !== squig.id ||
    p.ownershipKey !== squig.ownerships[0].sourceKey
  )
    return null;
  return {
    key: p.custom.key,
    name: p.custom.name,
    image: collectibleImageUrl(p.custom.artwork.uri),
    uri: p.custom.artwork.uri,
    sha256: p.custom.artwork.sha256,
  };
}

export async function exportCollectibles(kind: 'CUSTOM' | 'EDITION') {
  if (kind === 'CUSTOM') {
    const rows = await db().squigCustom.findMany({
      include: {
        squig: { select: { tokenId: true } },
        artwork: { select: { uri: true } },
      },
      orderBy: { key: 'asc' },
    });
    return {
      version: 1,
      kind,
      records: rows.map((c) => ({
        key: c.key,
        tokenId: c.squig.tokenId,
        name: c.name,
        description: c.description,
        artist: c.artist,
        issuedAt: c.issuedAt?.toISOString() ?? null,
        imageUri: c.artwork.uri,
        source: c.source,
        sourceReference: c.sourceReference,
        status: c.status,
        sortOrder: c.sortOrder,
        revision: c.revision,
      })),
    };
  }
  const rows = await db().squigEdition.findMany({
    include: {
      artwork: { select: { uri: true } },
      relations: { include: { squig: { select: { tokenId: true } } } },
    },
    orderBy: { slug: 'asc' },
  });
  return {
    version: 1,
    kind,
    records: rows.map((e) => ({
      slug: e.slug,
      name: e.name,
      description: e.description,
      artist: e.artist,
      issuedAt: e.issuedAt?.toISOString() ?? null,
      imageUri: e.artwork.uri,
      source: e.source,
      sourceReference: e.sourceReference,
      status: e.status,
      supply: e.supply,
      standard: e.standard,
      chainId: e.chainId,
      contractAddress: e.contractAddress,
      tokenId: e.tokenId,
      relatedTokens: e.relations
        .map((r) => r.squig.tokenId)
        .sort((a, b) => a - b),
      revision: e.revision,
    })),
  };
}
