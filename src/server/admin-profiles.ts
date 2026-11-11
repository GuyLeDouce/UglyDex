import 'server-only';
import { createHash } from 'node:crypto';
import type { Prisma } from '@/generated/prisma/client';
import { db } from './db';
import { readEnv } from './env';
import {
  adminProfileInput,
  configuredAdminOwner,
  slugSchema,
} from '@/domain/admin-profiles';
import { adoptDiscoveredWallet } from './collector-discovery';
import { markWalletDirty } from '@/sync/provenance';

export const adminProfileInclude = {
  wallets: {
    where: { status: 'ACTIVE' as const, chainId: 1 },
    orderBy: { firstSeenAt: 'asc' as const },
  },
  identities: { orderBy: { linkedAt: 'asc' as const } },
  dripIdentities: true,
  support: true,
} as const;

export function adminProfileRevision(
  profile: Prisma.CollectorGetPayload<{ include: typeof adminProfileInclude }>,
) {
  return createHash('sha256')
    .update(
      JSON.stringify({
        updatedAt: profile.updatedAt,
        wallets: profile.wallets,
        identities: profile.identities,
        drip: profile.dripIdentities,
        support: profile.support,
      }),
    )
    .digest('hex');
}

/** Called only after owner OAuth authorization. Credentials are never transferred between profiles. */
export async function updateAdminProfile(actor: string, raw: unknown) {
  const input = adminProfileInput.parse(raw);
  const env = readEnv();
  const owner = configuredAdminOwner(
    env.ADMIN_OWNER_DISCORD_ID,
    env.ADMIN_DISCORD_IDS,
  );
  return db().$transaction(
    async (tx) => {
      // Same order as the wallet-block trigger and identity flows.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(194731, 671)`;
      for (const address of [...input.wallets].sort())
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${address}, 0))`;
      for (const id of [...input.discordIds].sort())
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`discord:${id}`}, 0))`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${input.id}, 0))`;
      const old = await tx.collector.findUniqueOrThrow({
        where: { id: input.id },
        include: adminProfileInclude,
      });
      if (old.mergedIntoCollectorId) throw new Error('PROFILE_MERGED');
      if (
        old.updatedAt.toISOString() !== input.updatedAt ||
        adminProfileRevision(old) !== input.revision
      )
        throw new Error('PROFILE_CHANGED');
      if (input.slug !== old.slug) slugSchema.parse(input.slug);
      const slug =
        input.slug === old.slug ? old.slug : slugSchema.parse(input.slug);
      const oldWallets = old.wallets.map((w) => w.walletAddress);
      const oldDiscord = old.identities.map((i) => i.externalId);
      const addedWallets = input.wallets.filter((w) => !oldWallets.includes(w));
      const removedWallets = old.wallets.filter(
        (w) => !input.wallets.includes(w.walletAddress),
      );
      const addedDiscord = input.discordIds.filter(
        (id) => !oldDiscord.includes(id),
      );
      const removedDiscord = oldDiscord.filter(
        (id) => !input.discordIds.includes(id),
      );
      const identityChanged = !!(
        addedWallets.length ||
        removedWallets.length ||
        addedDiscord.length ||
        removedDiscord.length
      );
      if (
        owner &&
        (addedDiscord.includes(owner) || removedDiscord.includes(owner))
      )
        throw new Error('OWNER_PROTECTED');
      if (
        identityChanged &&
        !input.wallets.length &&
        !(await tx.collectorWallet.count({
          where: { collectorId: old.id, status: 'ACTIVE', chainId: { not: 1 } },
        })) &&
        !old.identities.some(
          (i) => input.discordIds.includes(i.externalId) && i.authenticatedAt,
        )
      )
        throw new Error('LAST_LOGIN');
      if (
        await tx.collector.findFirst({ where: { slug, id: { not: old.id } } })
      )
        throw new Error('USERNAME_CONFLICT');
      const now = new Date();
      for (const address of addedWallets) {
        const prior = await tx.collectorWallet.findUnique({
          where: {
            chainId_walletAddress: { chainId: 1, walletAddress: address },
          },
        });
        if (prior && prior.collectorId !== old.id)
          throw new Error('WALLET_CONFLICT');
        await adoptDiscoveredWallet(tx, address, old.id);
        const wallet = await tx.collectorWallet.upsert({
          where: {
            chainId_walletAddress: { chainId: 1, walletAddress: address },
          },
          create: {
            collectorId: old.id,
            chainId: 1,
            walletAddress: address,
            source: 'ADMIN_SUPPORT',
            verifiedAt: now,
          },
          update: {
            status: 'ACTIVE',
            revokedAt: null,
            verifiedAt: now,
            lastSeenAt: now,
            source: 'ADMIN_SUPPORT',
          },
        });
        await tx.historicalIdentityAttribution.create({
          data: {
            sourceKey: `admin:${wallet.id}:${now.toISOString()}`,
            collectorId: old.id,
            walletAddress: address,
            source: 'ADMIN_SUPPORT',
            status: 'VERIFIED',
            confidence: 'ADMIN_REVIEWED',
            effectiveFrom: now,
            reviewedAt: now,
            evidence: { actor, reason: input.reason },
          },
        });
        await markWalletDirty(tx, address);
      }
      for (const wallet of removedWallets) {
        await tx.collectorWallet.update({
          where: { id: wallet.id },
          data: { status: 'REVOKED', revokedAt: now, isPrimary: false },
        });
        await tx.historicalIdentityAttribution.updateMany({
          where: {
            collectorId: old.id,
            walletAddress: wallet.walletAddress,
            effectiveTo: null,
          },
          data: { effectiveTo: now },
        });
        await markWalletDirty(tx, wallet.walletAddress);
      }
      if (identityChanged) {
        await tx.collectorWallet.updateMany({
          where: { collectorId: old.id, chainId: 1 },
          data: { isPrimary: false },
        });
        if (input.wallets[0])
          await tx.collectorWallet.update({
            where: {
              chainId_walletAddress: {
                chainId: 1,
                walletAddress: input.wallets[0],
              },
            },
            data: { isPrimary: true },
          });
        await tx.externalIdentity.deleteMany({
          where: {
            collectorId: old.id,
            provider: 'DISCORD',
            externalId: { in: removedDiscord },
          },
        });
        for (const id of addedDiscord) {
          if (
            await tx.externalIdentity.findUnique({
              where: {
                provider_externalId: { provider: 'DISCORD', externalId: id },
              },
            })
          )
            throw new Error('DISCORD_CONFLICT');
          // Administrative correction is not an OAuth proof. The holder must authenticate this account.
          await tx.externalIdentity.create({
            data: { collectorId: old.id, provider: 'DISCORD', externalId: id },
          });
        }
        await tx.authSession.deleteMany({ where: { collectorId: old.id } });
        await tx.authChallenge.deleteMany({ where: { collectorId: old.id } });
        await tx.collectorMergeRequest.updateMany({
          where: {
            status: 'PENDING_CONFIRMATION',
            OR: [
              { survivorCollectorId: old.id },
              { absorbedCollectorId: old.id },
            ],
          },
          data: { status: 'EXPIRED' },
        });
      }
      const realmId = env.DRIP_REALM_ID;
      const priorDrip = old.dripIdentities.find((d) => d.realmId === realmId);
      const dripChanged = input.dripId !== (priorDrip?.dripMemberId ?? '');
      if (dripChanged && !realmId) throw new Error('DRIP_UNCONFIGURED');
      if (realmId && (dripChanged || identityChanged)) {
        if (
          input.dripId &&
          (await tx.dripIdentity.findFirst({
            where: {
              realmId,
              dripMemberId: input.dripId,
              collectorId: { not: old.id },
            },
          }))
        )
          throw new Error('DRIP_CONFLICT');
        await tx.dripIdentity.upsert({
          where: { realmId_collectorId: { realmId, collectorId: old.id } },
          create: {
            realmId,
            collectorId: old.id,
            dripMemberId: input.dripId || null,
            status: 'UNRESOLVED',
            source: 'ADMIN_SUPPORT',
          },
          update: {
            dripMemberId: input.dripId || null,
            realmMemberId: null,
            status: 'UNRESOLVED',
            source: 'ADMIN_SUPPORT',
            lastResolvedAt: null,
          },
        });
        await tx.charmBalance.updateMany({
          where: { collectorId: old.id, realmId },
          data: {
            balance: null,
            status: 'UNRESOLVED',
            observedAt: null,
            lastApiSuccessAt: null,
          },
        });
      }
      await tx.collector.update({
        where: { id: old.id },
        data: { slug, displayName: input.displayName || null, updatedAt: now },
      });
      await tx.collectorSupport.upsert({
        where: { collectorId: old.id },
        create: {
          collectorId: old.id,
          status: input.status,
          notes: input.notes,
          updatedBy: actor,
        },
        update: { status: input.status, notes: input.notes, updatedBy: actor },
      });
      await tx.operationalAudit.create({
        data: {
          actor,
          action: 'ADMIN_PROFILE_UPDATED',
          subject: old.id,
          detail: {
            reason: input.reason,
            before: {
              slug: old.slug,
              displayName: old.displayName,
              wallets: oldWallets,
              discordIds: oldDiscord,
              dripId: priorDrip?.dripMemberId ?? '',
              status: old.support?.status ?? 'ACTIVE',
              notes: old.support?.notes ?? '',
            },
            after: {
              slug,
              displayName: input.displayName,
              wallets: input.wallets,
              discordIds: input.discordIds,
              dripId: input.dripId,
              status: input.status,
              notes: input.notes,
            },
            sessionsRevoked: identityChanged,
          },
        },
      });
      return {
        saved: true,
        sessionsRevoked: identityChanged,
        dripNeedsVerification: dripChanged || identityChanged,
      };
    },
    { isolationLevel: 'Serializable', timeout: 15000 },
  );
}
