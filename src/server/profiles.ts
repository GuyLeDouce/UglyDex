import { publicNameSelect, publicCollectorName } from './public-collector-name';
import 'server-only';
import { db } from './db';
import { currentSession } from './auth';
import { squigToken, SQUIGS_CONTRACT } from '@/domain/validation';
import { publicIdentity } from '@/domain/profile';
import { publicCharm } from '@/domain/charm';
import { displayCustom } from './collectibles';
import { charmBalance } from './drip-sync';
import { confident, publicAttribution } from '@/domain/provenance';
import {
  activeAddresses,
  cardDTO,
  cardSelect,
  cardsWithBadges,
  collectionSummary,
  ownedScope,
  catalogScope,
} from './collections';
export async function collectorProfile(slug: string) {
  if (!/^[a-z0-9-]{1,80}$/i.test(slug)) return { status: 'missing' } as const;
  try {
    const c = await db().collector.findFirst({
      where: { slug: { equals: slug, mode: 'insensitive' } },
      include: {
        discoveredWallets: true,
        wallets: { where: { status: 'ACTIVE', revokedAt: null } },
        identities: { where: { authenticatedAt: { not: null } } },
      },
    });
    if (!c?.isPublic || c.mergedIntoCollectorId)
      return { status: 'missing' } as const;
    const [summary, featured] = await Promise.all([
      collectionSummary(c.id),
      db().squig.findMany({
        where: {
          AND: [
            catalogScope,
            ownedScope(
              c.wallets
                .filter((w) => w.chainId === 1)
                .map((w) => w.walletAddress),
            ),
            { tokenId: { in: c.featuredTokenIds } },
            { NOT: { provenance: { is: { dirty: true } } } },
          ],
        },
        select: cardSelect,
      }),
    ]);
    const identity = publicIdentity(c);
    const chainHistory = identity.unclaimed
      ? await db().walletOwnershipPeriod.findMany({
          where: {
            walletAddress: { in: identity.wallets },
            squig: {
              chainId: 1,
              contractAddress: SQUIGS_CONTRACT,
              provenance: { is: { complete: true, dirty: false } },
            },
          },
          select: {
            walletAddress: true,
            acquiredAt: true,
            lostAt: true,
            squig: { select: { tokenId: true } },
          },
          orderBy: [{ acquiredAt: 'desc' }, { id: 'asc' }],
          take: 24,
        })
      : [];
    const charm = c.showCharmBalance
      ? publicCharm(true, await charmBalance(c.id, false))
      : null;
    const featuredCards = await cardsWithBadges(featured);
    return {
      status: 'ready',
      collectorId: c.id,
      profile: identity,
      chainHistory: chainHistory.map((p) => ({
        walletAddress: p.walletAddress,
        tokenId: p.squig.tokenId,
        acquiredAt: p.acquiredAt.toISOString(),
        lostAt: p.lostAt?.toISOString() ?? null,
      })),
      ...(charm ? { charm } : {}),
      collectionVisibility: c.collectionVisibility,
      summary,
      featured:
        c.collectionVisibility === 'HIDDEN'
          ? []
          : await Promise.all(
              c.featuredTokenIds
                .flatMap((id) => featuredCards.filter((s) => s.tokenId === id))
                .map(async (s) => {
                  const art = await displayCustom(c.id, s.tokenId);
                  return {
                    ...s,
                    ...(art
                      ? {
                          image: art.image,
                          representation: 'Official Custom · ' + art.name,
                        }
                      : {}),
                  };
                }),
            ),
    } as const;
  } catch {
    return { status: 'unavailable' } as const;
  }
}
export async function squigProfile(token: string) {
  let tokenId: number;
  try {
    tokenId = squigToken(token);
  } catch {
    return { status: 'invalid' } as const;
  }
  try {
    const s = await db().squig.findUnique({
      where: {
        chainId_contractAddress_tokenId: {
          chainId: 1,
          contractAddress: SQUIGS_CONTRACT,
          tokenId,
        },
      },
      include: {
        traits: { orderBy: { traitType: 'asc' } },
        ownerships: { where: { isCurrent: true }, take: 1 },
        provenance: { select: { dirty: true, complete: true } },
        activities: {
          where: {
            sourceType: 'maw',
            eventType: 'MAW_DIGESTED',
            recordStatus: 'ACTIVE',
          },
          take: 1,
          select: { id: true },
        },
      },
    });
    if (!s) return { status: 'empty', tokenId } as const;
    const session = await currentSession(),
      current = s.activities.length ? undefined : s.ownerships[0];
    let owner: {
      slug: string;
      displayName: string | null;
    } | null = null;
    if (
      current &&
      (!s.provenance || (!s.provenance.dirty && s.provenance.complete))
    ) {
      const w = await db().collectorWallet.findUnique({
        where: {
          chainId_walletAddress: {
            chainId: 1,
            walletAddress: current.walletAddress,
          },
        },
        include: {
          collector: { select: { ...publicNameSelect, isPublic: true } },
        },
      });
      const evidence = await db().historicalIdentityAttribution.findMany({
        where: {
          chainId: 1,
          walletAddress: current.walletAddress,
          status: { notIn: ['REJECTED', 'INVALIDATED'] },
          effectiveFrom: { lte: current.observedAt },
          OR: [
            { effectiveTo: null },
            { effectiveTo: { gt: current.observedAt } },
          ],
        },
      });
      const valid =
        new Set(evidence.map((e) => e.collectorId)).size === 1 &&
        evidence.some((e) => confident(e) && e.collectorId === w?.collectorId);
      if (w?.status === 'ACTIVE' && publicAttribution(w.collector, valid))
        owner = {
          slug: w.collector.slug,
          displayName: publicCollectorName(w.collector),
        };
    }
    const addresses = session ? await activeAddresses(session.collectorId) : [];
    const discovery = session
      ? await db().squigDiscovery.findUnique({
          where: {
            collectorId_squigId: {
              collectorId: session.collectorId,
              squigId: s.id,
            },
          },
        })
      : null;
    const transferCount = await db().nftTransfer.count({
      where: {
        squigId: s.id,
        fromAddress: { not: '0x0000000000000000000000000000000000000000' },
      },
    });
    // The open chain-derived holding period survives self-transfers. Observation
    // and discovery timestamps are deliberately never acquisition dates.
    const holding =
      current && s.provenance?.complete && !s.provenance.dirty
        ? await db().walletOwnershipPeriod.findFirst({
            where: {
              squigId: s.id,
              walletAddress: current.walletAddress,
              lostAt: null,
            },
            orderBy: { acquiredAt: 'desc' },
            select: { acquiredAt: true },
          })
        : null;
    return {
      status: 'ready',
      squigId: s.id,
      digested: s.activities.length > 0,
      squig: cardDTO(s),
      owner,
      // Public chain data is separate from the opt-in collector attribution.
      holdingWallet: current?.walletAddress ?? null,
      relationship: session
        ? current && addresses.includes(current.walletAddress)
          ? 'Owned'
          : discovery?.everOwned
            ? 'Previously Owned'
            : 'Never Discovered'
        : null,
      discoveredAt: discovery?.everOwned ? discovery.discoveredAt : null,
      transferCount,
      ownershipUpdatedAt: current?.observedAt ?? null,
      acquiredAt: holding?.acquiredAt ?? null,
    } as const;
  } catch {
    return { status: 'unavailable', tokenId } as const;
  }
}
