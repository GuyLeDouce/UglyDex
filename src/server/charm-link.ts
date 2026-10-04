import 'server-only';
import { z } from 'zod';
import { normalizeWallet } from '@/domain/validation';
import { db } from './db';
import { dripConfig, dripRead } from './drip-sync';
import { DripReader, decimalBalance } from '@/integrations/drip';
import { getDripMemberMappings } from '@/integrations/wallet-links';
import { Prisma } from '@/generated/prisma/client';

const memberId = z.string().regex(/^[a-f0-9]{24}$/i);
const credentialSchema = z.object({
  format: z.string().optional(),
  publicIdentifier: z.string().optional(),
  oauthProvider: z.string().optional(),
  oauthAccountId: z.string().optional(),
});
const memberSchema = z.object({
  id: memberId,
  realmMemberId: z.string().nullable().optional(),
  credentials: z.array(credentialSchema).default([]),
  balances: z
    .array(z.object({ currencyId: z.string(), balance: decimalBalance }))
    .default([]),
});
const responseSchema = z.object({
  data: z.array(z.unknown()),
  meta: z
    .object({
      totalPages: z.number().int().positive().optional(),
      credentials: z.object({ access: z.boolean().optional() }).optional(),
    })
    .optional(),
});

function credentialIdentityProof(
  credentials: z.infer<typeof credentialSchema>[],
  discordIds: string[],
  wallets: string[],
) {
  const matchedDiscordIds = new Set(
    credentials.flatMap((credential) =>
      credential.oauthProvider?.toLowerCase() === 'discord' &&
      credential.oauthAccountId &&
      discordIds.includes(credential.oauthAccountId)
        ? [credential.oauthAccountId]
        : [],
    ),
  );
  const walletSet = new Set(wallets.map((wallet) => wallet.toLowerCase()));
  const matchedWallets = new Set(
    credentials.flatMap((credential) => {
      if (
        credential.format?.toLowerCase() !== 'wallet' ||
        !credential.publicIdentifier
      )
        return [];
      try {
        const wallet = normalizeWallet(credential.publicIdentifier);
        return walletSet.has(wallet.toLowerCase()) ? [wallet] : [];
      } catch {
        return [];
      }
    }),
  );
  return {
    discordIds: [...matchedDiscordIds],
    wallets: [...matchedWallets],
  };
}

/**
 * Verify a user-supplied DRIP ID through the configured read-only API, then
 * save it only when DRIP credentials or the exact verified wallet_links pair
 * prove that the member belongs to this authenticated Collector.
 */
export async function verifyAndLinkDripMember(
  collectorId: string,
  submittedId: string,
) {
  const id = memberId.parse(submittedId),
    config = dripConfig();
  const [identities, wallets] = await Promise.all([
    db().externalIdentity.findMany({
      where: {
        collectorId,
        provider: 'DISCORD',
        authenticatedAt: { not: null },
      },
      select: { externalId: true },
    }),
    db().collectorWallet.findMany({
      where: {
        collectorId,
        chainId: 1,
        status: 'ACTIVE',
        revokedAt: null,
      },
      select: { walletAddress: true },
    }),
  ]);
  const discordIds = [
      ...new Set(identities.map((identity) => identity.externalId)),
    ],
    walletAddresses = [
      ...new Set(wallets.map((wallet) => wallet.walletAddress)),
    ];
  const pairs = discordIds.flatMap((discordId) =>
    walletAddresses.map((walletAddress) => ({ discordId, walletAddress })),
  );

  let sourceProofPairs: { discordId: string; walletAddress: string }[] = [];
  if (pairs.length > 0 && pairs.length <= 25) {
    const mappings = await getDripMemberMappings(pairs);
    if (mappings.ok) {
      const mappedIds = new Set(
        mappings.data.map((mapping) => mapping.dripMemberId),
      );
      if (mappedIds.size > 0) {
        if (mappedIds.size !== 1 || !mappedIds.has(id))
          throw new Error('DRIP_MEMBER_IDENTITY_UNVERIFIED');
        sourceProofPairs = mappings.data.map((mapping) => ({
          discordId: mapping.discordId,
          walletAddress: mapping.walletAddress,
        }));
      }
    }
  }

  const response = await dripRead((reader: DripReader) =>
    reader.searchMembersByDripId([id]),
  );
  const parsed = responseSchema.parse(response.body);
  if ((parsed.meta?.totalPages ?? 1) > 1 || parsed.data.length !== 1)
    throw new Error('DRIP_MEMBER_IDENTITY_UNVERIFIED');
  const member = memberSchema.parse(parsed.data[0]);
  if (member.id !== id) throw new Error('DRIP_MEMBER_IDENTITY_UNVERIFIED');

  const credentialProof = credentialIdentityProof(
    member.credentials,
    discordIds,
    walletAddresses,
  );
  if (
    sourceProofPairs.length === 0 &&
    (parsed.meta?.credentials?.access === false ||
      (credentialProof.discordIds.length === 0 &&
        credentialProof.wallets.length === 0))
  )
    throw new Error('DRIP_MEMBER_IDENTITY_UNVERIFIED');

  const balances = member.balances.filter(
    (balance) => balance.currencyId === config.DRIP_REALM_POINT_ID,
  );
  if (balances.length > 1) throw new Error('DRIP_MEMBER_IDENTITY_UNVERIFIED');
  const value = balances.length === 1 ? balances[0].balance : null;
  const source =
    sourceProofPairs.length > 0
      ? 'VERIFIED_WALLET_LINK'
      : 'EXACT_DRIP_CREDENTIAL';
  const now = new Date();

  await db().$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'drip-identity:' + config.DRIP_REALM_ID},0))`;
    const [prior, duplicate, currentIdentities, currentWallets] =
      await Promise.all([
        tx.dripIdentity.findUnique({
          where: {
            realmId_collectorId: {
              realmId: config.DRIP_REALM_ID,
              collectorId,
            },
          },
        }),
        tx.dripIdentity.findUnique({
          where: {
            realmId_dripMemberId: {
              realmId: config.DRIP_REALM_ID,
              dripMemberId: id,
            },
          },
        }),
        tx.externalIdentity.findMany({
          where: {
            collectorId,
            provider: 'DISCORD',
            authenticatedAt: { not: null },
          },
          select: { externalId: true },
        }),
        tx.collectorWallet.findMany({
          where: {
            collectorId,
            chainId: 1,
            status: 'ACTIVE',
            revokedAt: null,
          },
          select: { walletAddress: true },
        }),
      ]);
    const hasCurrentProof =
      sourceProofPairs.length > 0
        ? sourceProofPairs.some(
            (pair) =>
              currentIdentities.some(
                (identity) => identity.externalId === pair.discordId,
              ) &&
              currentWallets.some(
                (wallet) =>
                  wallet.walletAddress.toLowerCase() ===
                  pair.walletAddress.toLowerCase(),
              ),
          )
        : credentialProof.discordIds.some((discordId) =>
            currentIdentities.some(
              (identity) => identity.externalId === discordId,
            ),
          ) ||
          credentialProof.wallets.some((walletAddress) =>
            currentWallets.some(
              (wallet) =>
                wallet.walletAddress.toLowerCase() ===
                walletAddress.toLowerCase(),
            ),
          );
    if (!hasCurrentProof) throw new Error('DRIP_MEMBER_IDENTITY_UNVERIFIED');
    if (
      prior?.status === 'CONFLICT' ||
      (prior?.dripMemberId && prior.dripMemberId !== id) ||
      (duplicate && duplicate.collectorId !== collectorId)
    )
      throw new Error('DRIP_MEMBER_IDENTITY_UNVERIFIED');

    const identity = await tx.dripIdentity.upsert({
      where: {
        realmId_collectorId: {
          realmId: config.DRIP_REALM_ID,
          collectorId,
        },
      },
      create: {
        realmId: config.DRIP_REALM_ID,
        collectorId,
        dripMemberId: id,
        realmMemberId: member.realmMemberId ?? null,
        status: 'RESOLVED',
        source,
        lastResolvedAt: now,
      },
      update: {
        dripMemberId: id,
        realmMemberId: member.realmMemberId ?? null,
        status: 'RESOLVED',
        source,
        lastResolvedAt: now,
      },
    });
    await tx.charmBalance.upsert({
      where: {
        collectorId_realmId_currencyId: {
          collectorId,
          realmId: config.DRIP_REALM_ID,
          currencyId: config.DRIP_REALM_POINT_ID,
        },
      },
      create: {
        collectorId,
        realmId: config.DRIP_REALM_ID,
        currencyId: config.DRIP_REALM_POINT_ID,
        dripIdentityId: identity.id,
        balance: value === null ? null : new Prisma.Decimal(value),
        observedAt: value === null ? null : now,
        lastApiSuccessAt: now,
        status: value === null ? 'UNKNOWN' : 'CURRENT',
      },
      update: {
        dripIdentityId: identity.id,
        ...(value === null
          ? { status: 'UNKNOWN' }
          : {
              balance: new Prisma.Decimal(value),
              observedAt: now,
              status: 'CURRENT',
            }),
        lastApiSuccessAt: now,
      },
    });
  });
  return { balanceAvailable: value !== null };
}
