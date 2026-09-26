import 'server-only';
import { db } from './db';
import { gallerySchema, galleryAccess } from '@/domain/sharing';
import {
  activeAddresses,
  catalogScope,
  ownedScope,
  cardSelect,
  cardDTO,
} from './collections';
import { dexView } from './dex';
export async function eligibleGalleryTokens(collectorId: string, mode: string) {
  const addresses = await activeAddresses(collectorId);
  const current = await db().squig.findMany({
    where: {
      AND: [
        catalogScope,
        ownedScope(addresses),
        { NOT: { provenance: { is: { dirty: true } } } },
      ],
    },
    select: { tokenId: true },
  });
  const currentIds = current.map((s) => s.tokenId);
  if (mode === 'CURRENT_COLLECTION')
    return { eligible: currentIds, current: currentIds };
  const dex = await dexView(collectorId);
  return {
    eligible: dex?.status === 'ready' ? dex.discoveredIds : [],
    current: currentIds,
  };
}
export async function saveGallery(collectorId: string, input: unknown) {
  const g = gallerySchema.parse(input),
    eligible = await eligibleGalleryTokens(collectorId, g.mode);
  if (g.items.some((i) => !eligible.eligible.includes(i.tokenId)))
    throw new Error('INELIGIBLE_SQUIG');
  const rows = await db().squig.findMany({
    where: { ...catalogScope, tokenId: { in: g.items.map((i) => i.tokenId) } },
    select: { id: true, tokenId: true },
  });
  return db().$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'gallery:' + collectorId},0))`;
    if (g.id) {
      const old = await tx.collectorGallery.findFirst({
        where: { id: g.id, collectorId },
      });
      if (!old || old.revision !== g.revision) throw new Error('EDIT_CONFLICT');
    } else if (
      (await tx.collectorGallery.count({ where: { collectorId } })) >= 12
    )
      throw new Error('GALLERY_LIMIT');
    if (g.featured)
      await tx.collectorGallery.updateMany({
        where: { collectorId, featured: true },
        data: { featured: false },
      });
    const data = {
      slug: g.slug,
      name: g.name,
      description: g.description,
      visibility: g.visibility,
      mode: g.mode,
      layout: g.layout,
      coverTokenId: g.coverTokenId,
      featured: g.featured,
    };
    const gallery = g.id
      ? await tx.collectorGallery.update({
          where: { id: g.id },
          data: { ...data, revision: { increment: 1 } },
        })
      : await tx.collectorGallery.create({ data: { ...data, collectorId } });
    const added = await tx.collectorGalleryItem.findMany({
      where: { galleryId: gallery.id },
      select: { squigId: true, addedAt: true },
    });
    // Replace only this gallery's presentation items; canonical ownership/history is untouched.
    await tx.collectorGalleryItem.deleteMany({
      where: { galleryId: gallery.id },
    });
    if (g.items.length)
      await tx.collectorGalleryItem.createMany({
        data: g.items.map((i, sortOrder) => ({
          galleryId: gallery.id,
          squigId: rows.find((s) => s.tokenId === i.tokenId)!.id,
          sortOrder,
          addedAt: added.find(
            (a) => a.squigId === rows.find((s) => s.tokenId === i.tokenId)!.id,
          )?.addedAt,
          caption: i.caption,
          section: i.section,
        })),
      });
    return { id: gallery.id, slug: gallery.slug };
  });
}
export async function deleteGallery(collectorId: string, id: string) {
  await db().collectorGallery.deleteMany({ where: { id, collectorId } });
}
export async function galleryList(collectorId: string, owner = false) {
  return db().collectorGallery.findMany({
    where: {
      collectorId,
      ...(!owner
        ? { visibility: 'PUBLIC', collector: { isPublic: true } }
        : {}),
    },
    orderBy: [{ featured: 'desc' }, { createdAt: 'asc' }],
    select: {
      id: owner,
      slug: true,
      name: true,
      description: true,
      visibility: true,
      layout: true,
      featured: true,
    },
  });
}
export async function galleryView(
  slug: string,
  gallerySlug: string,
  viewerId?: string,
) {
  const g = await db().collectorGallery.findFirst({
    where: { slug: gallerySlug, collector: { slug } },
    include: {
      collector: {
        select: { id: true, slug: true, displayName: true, isPublic: true },
      },
      items: {
        orderBy: { sortOrder: 'asc' },
        include: { squig: { select: cardSelect } },
      },
    },
  });
  if (
    !g ||
    !galleryAccess(
      g.collector.isPublic,
      g.visibility,
      g.collectorId === viewerId,
    )
  )
    return null;
  const allowed = await eligibleGalleryTokens(g.collectorId, g.mode);
  const items = g.items
    .filter((i) => allowed.eligible.includes(i.squig.tokenId))
    .map((i) => ({
      ...cardDTO(i.squig),
      caption: i.caption,
      section: i.section,
      currentlyOwned: allowed.current.includes(i.squig.tokenId),
    }));
  return {
    slug: g.slug,
    name: g.name,
    description: g.description,
    visibility: g.visibility,
    mode: g.mode,
    layout: g.layout,
    coverTokenId: items.some((i) => i.tokenId === g.coverTokenId)
      ? g.coverTokenId
      : null,
    collector: {
      slug: g.collector.slug,
      name: g.collector.displayName || g.collector.slug,
    },
    items,
    publicAvailable: g.collector.isPublic && g.visibility !== 'PRIVATE',
    indexable: g.collector.isPublic && g.visibility === 'PUBLIC',
  };
}
