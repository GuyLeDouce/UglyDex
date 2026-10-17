import 'server-only';
import { setTimeout as delay } from 'node:timers/promises';
import { z } from 'zod';
import { db } from './db';
import {
  DripReader,
  DripReadError,
  exactMembers,
  exactDripMembers,
  type DripResponse,
} from '@/integrations/drip';
import { getDripMemberMappings } from '@/integrations/wallet-links';
import { dripBudget, balanceView, dripHeaderSpacing } from '@/domain/charm';
import { hash } from '@/domain/events';
import { launchContext, recordGate } from './launch';
import { assertOperation } from './deployment';
import { Prisma } from '@/generated/prisma/client';
import { proveDripAlignment } from './drip-alignment';

const configSchema = z.object({
  DRIP_READ_API_KEY: z.string().min(1),
  DRIP_REALM_ID: z.string().regex(/^[a-f0-9]{24}$/i),
  DRIP_REALM_POINT_ID: z.string().regex(/^[a-f0-9]{24}$/i),
  DRIP_MAX_RPM: z.coerce.number().int().min(1).max(6).default(6),
  DRIP_SYNC_INTERVAL_MS: z.coerce
    .number()
    .int()
    .min(1800000)
    .max(86400000)
    .default(1800000),
  DRIP_STALE_AFTER_MS: z.coerce
    .number()
    .int()
    .min(60000)
    .max(3600000)
    .default(300000),
});
export function dripConfig() {
  return configSchema.parse(process.env);
}
async function state() {
  const c = dripConfig();
  const row = await db().dripSyncState.upsert({
    where: { realmId: c.DRIP_REALM_ID },
    create: {
      realmId: c.DRIP_REALM_ID,
      currencyId: c.DRIP_REALM_POINT_ID,
      month: new Date().toISOString().slice(0, 7),
    },
    update: {},
  });
  if (row.currencyId !== c.DRIP_REALM_POINT_ID)
    throw Error('CHARM_ECONOMY_MISMATCH');
  return row;
}
export async function dripRead(
  run: (client: DripReader) => Promise<DripResponse>,
) {
  const c = dripConfig();
  await state();
  const allowed = await db().$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'drip-budget:' + c.DRIP_REALM_ID},0))`;
    const row = await tx.dripSyncState.findUniqueOrThrow({
      where: { realmId: c.DRIP_REALM_ID },
    });
    const budget = dripBudget(row, new Date(), c.DRIP_MAX_RPM);
    if (!budget.allowed) return false;
    await tx.dripSyncState.update({
      where: { realmId: row.realmId },
      data: {
        month: budget.month,
        monthRequests: budget.monthRequests,
        nextRequestAt: budget.nextRequestAt,
        totalRequests: { increment: 1 },
      },
    });
    return true;
  });
  if (!allowed) throw Error('DRIP_BUDGET_WAIT');
  let result: DripResponse | undefined, error: unknown;
  try {
    result = await run(
      new DripReader({ key: c.DRIP_READ_API_KEY, realm: c.DRIP_REALM_ID }),
    );
  } catch (e) {
    error = e;
  }
  const rate =
    result?.rate ?? (error instanceof DripReadError ? error.rate : null);
  await db().$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'drip-budget:' + c.DRIP_REALM_ID},0))`;
    const row = await tx.dripSyncState.findUniqueOrThrow({
      where: { realmId: c.DRIP_REALM_ID },
    });
    const is429 = error instanceof Error && error.message === 'DRIP_HTTP_429';
    const backoff = Math.max(
      +row.nextRequestAt,
      rate?.retryAt ?? 0,
      rate?.remaining !== null &&
        rate?.remaining !== undefined &&
        rate.remaining < 6
        ? (rate.resetAt ?? Date.now() + 60000)
        : 0,
      is429 ? Date.now() + 60000 : 0,
      error && !is429 ? Date.now() + 60000 : 0,
      rate ? Date.now() + dripHeaderSpacing(rate, c.DRIP_MAX_RPM) : 0,
    );
    await tx.dripSyncState.update({
      where: { realmId: row.realmId },
      data: {
        nextRequestAt: new Date(backoff),
        ...(rate
          ? {
              lastRateLimit: rate,
              minimumRemaining:
                rate.remaining === null
                  ? row.minimumRemaining
                  : Math.min(
                      row.minimumRemaining ?? rate.remaining,
                      rate.remaining,
                    ),
            }
          : {}),
        ...(is429 ? { last429At: new Date(), total429: { increment: 1 } } : {}),
        ...(result
          ? { lastSuccessAt: new Date(), errorCode: null }
          : {
              errorCode:
                error instanceof DripReadError
                  ? error.message
                  : 'DRIP_READ_FAILED',
            }),
      },
    });
  });
  if (error) throw error;
  return result!;
}
export async function verifyDripAlignment(bots: {
  uglyBotRealm: string;
  uglyBotCurrency: string;
  gauntletRealm: string;
  gauntletCurrency: string;
}) {
  await assertOperation('launch');
  try {
    return await checkDripAlignment(bots);
  } catch (error) {
    if (error instanceof Error && error.message === 'CHARM_ECONOMY_MISMATCH') {
      const c = dripConfig();
      await db().dripSyncState.updateMany({
        where: { realmId: c.DRIP_REALM_ID },
        data: {
          alignmentHash: null,
          alignmentCommit: null,
          errorCode: 'CHARM_ECONOMY_MISMATCH',
        },
      });
      await recordGate('CHARM_DRIP', 'FAILED', 'CHARM_ECONOMY_MISMATCH', {});
    }
    throw error;
  }
}
async function checkDripAlignment(bots: {
  uglyBotRealm: string;
  uglyBotCurrency: string;
  gauntletRealm: string;
  gauntletCurrency: string;
}) {
  const c = dripConfig();
  const evidence = await proveDripAlignment(
    bots,
    { realm: c.DRIP_REALM_ID, currency: c.DRIP_REALM_POINT_ID },
    {
      getRealm: () => dripRead((reader) => reader.getRealm()),
      getCurrencies: () => dripRead((reader) => reader.getCurrencies()),
      findResolvedDripMemberId: async () =>
        (
          await db().dripIdentity.findFirst({
            where: {
              realmId: c.DRIP_REALM_ID,
              status: 'RESOLVED',
              dripMemberId: { not: null },
            },
            orderBy: { lastResolvedAt: 'desc' },
            select: { dripMemberId: true },
          })
        )?.dripMemberId ?? null,
      searchMembersByDripId: (ids) =>
        dripRead((reader) => reader.searchMembersByDripId(ids)),
      waitAfterRealm: () => delay(Math.ceil(60000 / c.DRIP_MAX_RPM) + 50),
      waitBeforeFallback: async () => {
        const syncState = await db().dripSyncState.findUnique({
          where: { realmId: c.DRIP_REALM_ID },
          select: { nextRequestAt: true },
        });
        const waitMs = Math.max(
          0,
          syncState ? +syncState.nextRequestAt - Date.now() : 0,
        );
        if (waitMs > 0) await delay(waitMs + 50);
      },
    },
  );
  await db().dripSyncState.update({
    where: { realmId: c.DRIP_REALM_ID },
    data: {
      alignment: evidence,
      alignmentHash: hash(evidence),
      alignmentAt: new Date(),
      alignmentCommit: launchContext().commit,
    },
  });
  return evidence;
}
export async function queueCharmRefresh(collectorId: string, user = false) {
  const c = dripConfig();
  return db().$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'charm-refresh:' + collectorId},0))`;
    const where = {
      realmId_collectorId: { realmId: c.DRIP_REALM_ID, collectorId },
    };
    const prior = await tx.charmRefreshRequest.findUnique({ where });
    const now = new Date();
    if (user && prior && prior.nextUserRequestAt > now) return false;
    await tx.charmRefreshRequest.upsert({
      where,
      create: {
        realmId: c.DRIP_REALM_ID,
        collectorId,
        nextUserRequestAt: new Date(+now + 120000),
      },
      update: {
        pending: true,
        ...(user ? { nextUserRequestAt: new Date(+now + 120000) } : {}),
        generation: { increment: 1 },
      },
    });
    return true;
  });
}
export async function charmBalance(collectorId: string, enqueue = true) {
  const parsed = configSchema.safeParse(process.env);
  if (!parsed.success) return balanceView(null);
  const c = parsed.data;
  const row = await db().charmBalance.findUnique({
    where: {
      collectorId_realmId_currencyId: {
        collectorId,
        realmId: c.DRIP_REALM_ID,
        currencyId: c.DRIP_REALM_POINT_ID,
      },
    },
  });
  const view = balanceView(row, new Date(), c.DRIP_STALE_AFTER_MS);
  if (view.stale && enqueue)
    await queueCharmRefresh(collectorId).catch(() => {});
  return view;
}

export async function shouldPromptDripLink(collectorId: string) {
  const parsed = configSchema.safeParse(process.env);
  if (!parsed.success) return true;
  const identity = await db().dripIdentity.findUnique({
    where: {
      realmId_collectorId: {
        collectorId,
        realmId: parsed.data.DRIP_REALM_ID,
      },
    },
    select: { status: true },
  });
  return !identity || !['RESOLVED', 'CONFLICT'].includes(identity.status);
}

export async function syncDripDue() {
  try {
    return await syncDripBatch();
  } catch (e) {
    const code =
      e instanceof Error && /^DRIP_[A-Z0-9_]+$/.test(e.message)
        ? e.message
        : 'DRIP_SYNC_FAILED';
    if (code !== 'DRIP_BUDGET_WAIT') {
      const parsed = configSchema.safeParse(process.env);
      if (parsed.success) {
        await db().dripSyncState.updateMany({
          where: { realmId: parsed.data.DRIP_REALM_ID },
          data: { errorCode: code },
        });
        await db().dripSyncState.updateMany({
          where: {
            realmId: parsed.data.DRIP_REALM_ID,
            nextRequestAt: { lt: new Date(Date.now() + 60000) },
          },
          data: { nextRequestAt: new Date(Date.now() + 60000) },
        });
      }
    }
    return { status: code };
  }
}
async function syncDripBatch() {
  if (!configSchema.safeParse(process.env).success)
    return { status: 'UNCONFIGURED' };
  const c = dripConfig(),
    s = await state();
  if (!s.alignmentHash || s.alignmentCommit !== launchContext().commit)
    return { status: 'ALIGNMENT_REQUIRED' };
  if (s.nextRequestAt > new Date()) return { status: 'NOT_DUE' };
  const requests = await db().charmRefreshRequest.findMany({
    where: { realmId: s.realmId, pending: true },
    orderBy: { requestedAt: 'asc' },
    take: 25,
  });
  const sweep = requests.length === 0;
  if (sweep && !s.sweepStartedAt && s.nextSweepAt > new Date())
    return { status: 'NOT_DUE' };
  if (sweep && !s.sweepStartedAt)
    await db().dripSyncState.update({
      where: { realmId: s.realmId },
      data: { sweepStartedAt: new Date(), memberCursor: null },
    });
  const identities = await db().externalIdentity.findMany({
    where: {
      provider: 'DISCORD',
      ...(sweep
        ? s.memberCursor
          ? { id: { gt: s.memberCursor } }
          : {}
        : { collectorId: { in: requests.map((r) => r.collectorId) } }),
    },
    orderBy: { id: 'asc' },
    take: 25,
  });
  if (!identities.length) {
    if (sweep)
      await db().dripSyncState.update({
        where: { realmId: s.realmId },
        data: {
          lastFullSweep: new Date(),
          nextSweepAt: new Date(Date.now() + c.DRIP_SYNC_INTERVAL_MS),
          sweepStartedAt: null,
          memberCursor: null,
        },
      });
    else
      await db().charmRefreshRequest.updateMany({
        where: {
          realmId: s.realmId,
          collectorId: { in: requests.map((r) => r.collectorId) },
        },
        data: { pending: false },
      });
    return { status: 'COMPLETE', queried: 0 };
  }
  const wallets = await db().collectorWallet.findMany({
    where: {
      collectorId: { in: identities.map((identity) => identity.collectorId) },
      chainId: 1,
      status: 'ACTIVE',
      revokedAt: null,
    },
    select: { collectorId: true, walletAddress: true },
  });
  const identityByDiscord = new Map(
    identities.map((identity) => [identity.externalId, identity]),
  );
  const pairs = identities.flatMap((identity) =>
    wallets
      .filter((wallet) => wallet.collectorId === identity.collectorId)
      .map((wallet) => ({
        discordId: identity.externalId,
        walletAddress: wallet.walletAddress,
      })),
  );
  const mappings = await getDripMemberMappings(pairs);
  if (!mappings.ok) {
    await db().dripSyncState.update({
      where: { realmId: s.realmId },
      data: {
        errorCode: `WALLET_LINKS_${mappings.reason.toUpperCase()}`,
        nextRequestAt: new Date(Date.now() + c.DRIP_SYNC_INTERVAL_MS),
      },
    });
    return {
      status: `WALLET_LINKS_${mappings.reason.toUpperCase()}`,
      queried: 0,
    };
  }

  const mappedIds = new Map<string, Set<string>>();
  for (const mapping of mappings.data) {
    const ids = mappedIds.get(mapping.discordId) ?? new Set<string>();
    ids.add(mapping.dripMemberId);
    mappedIds.set(mapping.discordId, ids);
  }
  const resolvedByDiscord = new Map<
    string,
    ReturnType<typeof exactMembers>[number]
  >();
  const ambiguousDiscords = new Set<string>();
  for (const [discordId, memberIds] of mappedIds)
    if (memberIds.size > 1) {
      ambiguousDiscords.add(discordId);
      resolvedByDiscord.set(discordId, {
        discordId,
        status: 'CONFLICT',
        dripMemberId: null,
        realmMemberId: null,
        balance: null,
      });
    }

  const candidates = identities.flatMap((identity) => {
    const memberIds = mappedIds.get(identity.externalId);
    if (!memberIds?.size || ambiguousDiscords.has(identity.externalId))
      return [];
    return [
      { discordId: identity.externalId, dripMemberId: [...memberIds][0] },
    ];
  });
  const collectorsByDripId = new Map<string, Set<string>>();
  for (const candidate of candidates) {
    const collectorIds =
      collectorsByDripId.get(candidate.dripMemberId) ?? new Set<string>();
    collectorIds.add(identityByDiscord.get(candidate.discordId)!.collectorId);
    collectorsByDripId.set(candidate.dripMemberId, collectorIds);
  }
  const conflictedDripIds = new Set(
    [...collectorsByDripId]
      .filter(([, collectorIds]) => collectorIds.size > 1)
      .map(([id]) => id),
  );
  for (const candidate of candidates)
    if (conflictedDripIds.has(candidate.dripMemberId)) {
      ambiguousDiscords.add(candidate.discordId);
      resolvedByDiscord.set(candidate.discordId, {
        discordId: candidate.discordId,
        status: 'CONFLICT',
        dripMemberId: candidate.dripMemberId,
        realmMemberId: null,
        balance: null,
      });
    }

  const mappedCandidates = candidates.filter(
    (candidate) => !conflictedDripIds.has(candidate.dripMemberId),
  );
  const mappedMemberIds = [
    ...new Set(mappedCandidates.map((candidate) => candidate.dripMemberId)),
  ];
  if (mappedMemberIds.length) {
    try {
      const response = await dripRead((reader) =>
        reader.searchMembersByDripId(mappedMemberIds),
      );
      const body = z
        .object({
          data: z.array(z.unknown()),
          meta: z.object({ totalPages: z.number().optional() }).optional(),
        })
        .parse(response.body);
      if ((body.meta?.totalPages ?? 1) > 1)
        throw Error('DRIP_ID_SEARCH_REQUIRES_PAGINATION');
      for (const member of exactDripMembers(
        body.data,
        mappedMemberIds,
        c.DRIP_REALM_POINT_ID,
      )) {
        const candidate = mappedCandidates.find(
          (entry) => entry.dripMemberId === member.dripMemberId,
        );
        if (!candidate) continue;
        resolvedByDiscord.set(candidate.discordId, {
          discordId: candidate.discordId,
          ...member,
        });
      }
    } catch (error) {
      if (
        !(error instanceof DripReadError) ||
        error.message !== 'DRIP_HTTP_403'
      )
        throw error;
      // A forbidden lookup is unresolved evidence, not a reason to pin the
      // durable sweep cursor. This lets later exact wallet_links mappings be
      // tried with drip-id while keeping these balances unknown.
      for (const candidate of mappedCandidates)
        resolvedByDiscord.set(candidate.discordId, {
          discordId: candidate.discordId,
          status: 'UNRESOLVED',
          dripMemberId: null,
          realmMemberId: null,
          balance: null,
        });
    }
  }

  // One DRIP request per worker batch keeps the shared Realm budget predictable.
  // Use exact Discord-ID lookup only for a batch with no verified source mapping.
  // Never fall back to username, nickname, or fuzzy search.
  const directIdentities = mappedMemberIds.length
    ? []
    : identities.filter(
        (identity) => !ambiguousDiscords.has(identity.externalId),
      );
  if (directIdentities.length) {
    try {
      const response = await dripRead((reader) =>
        reader.searchMembers(
          directIdentities.map((identity) => identity.externalId),
        ),
      );
      const body = z
        .object({
          data: z.array(z.unknown()),
          meta: z
            .object({
              totalPages: z.number().optional(),
              credentials: z
                .object({ access: z.boolean().optional() })
                .optional(),
            })
            .optional(),
        })
        .parse(response.body);
      if ((body.meta?.totalPages ?? 1) > 1)
        throw Error('DRIP_SEARCH_REQUIRES_PAGINATION');
      if (body.meta?.credentials?.access === false) {
        for (const identity of directIdentities)
          resolvedByDiscord.set(identity.externalId, {
            discordId: identity.externalId,
            status: 'UNRESOLVED',
            dripMemberId: null,
            realmMemberId: null,
            balance: null,
          });
        await db().dripSyncState.update({
          where: { realmId: s.realmId },
          data: { errorCode: 'DRIP_CREDENTIAL_READ_REQUIRED' },
        });
      } else {
        for (const member of exactMembers(
          body.data,
          directIdentities.map((identity) => identity.externalId),
          c.DRIP_REALM_POINT_ID,
        ))
          resolvedByDiscord.set(member.discordId, member);
      }
    } catch (error) {
      if (
        !(error instanceof DripReadError) ||
        error.message !== 'DRIP_HTTP_403'
      )
        throw error;
      // DRIP can deny Discord-credential reads while allowing exact drip-id
      // reads. Record this batch as unresolved and advance; a later batch with
      // a verified wallet_links mapping will use only the mapped drip-id.
      for (const identity of directIdentities)
        resolvedByDiscord.set(identity.externalId, {
          discordId: identity.externalId,
          status: 'UNRESOLVED',
          dripMemberId: null,
          realmMemberId: null,
          balance: null,
        });
    }
  }
  const resolved = identities.map(
    (identity) =>
      resolvedByDiscord.get(identity.externalId) ?? {
        discordId: identity.externalId,
        status: 'UNRESOLVED' as const,
        dripMemberId: null,
        realmMemberId: null,
        balance: null,
      },
  );
  const counts = {
    queried: identities.length,
    resolved: 0,
    unresolved: 0,
    conflicts: 0,
    balances: 0,
  };
  await db().$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'drip-identity:' + s.realmId},0))`;
    for (const r of resolved) {
      const identity = identities.find((i) => i.externalId === r.discordId)!;
      const collectorId = identity.collectorId;
      const currentIdentity = await tx.externalIdentity.findUnique({
        where: { id: identity.id },
      });
      if (
        !currentIdentity ||
        currentIdentity.collectorId !== collectorId ||
        currentIdentity.externalId !== r.discordId ||
        currentIdentity.provider !== 'DISCORD'
      )
        throw Error('DRIP_IDENTITY_CHANGED_DURING_READ');
      const where = {
        realmId_collectorId: { realmId: s.realmId, collectorId },
      };
      const prior = await tx.dripIdentity.findUnique({ where });
      const duplicate = r.dripMemberId
        ? await tx.dripIdentity.findUnique({
            where: {
              realmId_dripMemberId: {
                realmId: s.realmId,
                dripMemberId: r.dripMemberId,
              },
            },
          })
        : null;
      const conflict =
        prior?.status === 'CONFLICT' ||
        r.status === 'CONFLICT' ||
        (duplicate && duplicate.collectorId !== collectorId) ||
        (prior?.dripMemberId &&
          r.dripMemberId &&
          prior.dripMemberId !== r.dripMemberId);
      const status = conflict ? 'CONFLICT' : r.status;
      const hasVerifiedPriorIdentity =
        prior?.status === 'RESOLVED' &&
        !!prior.dripMemberId &&
        [
          'VERIFIED_WALLET_LINK',
          'EXACT_DRIP_CREDENTIAL',
          'EXACT_DISCORD_CREDENTIAL',
        ].includes(prior.source);
      if (status === 'UNRESOLVED' && hasVerifiedPriorIdentity) {
        // A missing member result or a read failure cannot revoke proof that
        // was previously established. Leave identity and balance timestamps
        // untouched so normal age checks make the cached balance stale.
        counts.unresolved++;
        continue;
      }
      if (status !== 'RESOLVED') {
        counts[status === 'CONFLICT' ? 'conflicts' : 'unresolved']++;
        await tx.dripIdentity.upsert({
          where,
          create: {
            realmId: s.realmId,
            collectorId,
            status,
            source: mappedIds.has(r.discordId)
              ? 'VERIFIED_WALLET_LINK'
              : 'EXACT_DISCORD_CREDENTIAL',
          },
          update: {
            status,
            source: mappedIds.has(r.discordId)
              ? 'VERIFIED_WALLET_LINK'
              : 'EXACT_DISCORD_CREDENTIAL',
          },
        });
        await tx.charmBalance.updateMany({
          where: { realmId: s.realmId, collectorId },
          data: { status },
        });
        if (duplicate && duplicate.collectorId !== collectorId) {
          await tx.dripIdentity.update({
            where: { id: duplicate.id },
            data: { status: 'CONFLICT' },
          });
          await tx.charmBalance.updateMany({
            where: { dripIdentityId: duplicate.id },
            data: { status: 'CONFLICT' },
          });
        }
        continue;
      }
      const mapping = await tx.dripIdentity.upsert({
        where,
        create: {
          realmId: s.realmId,
          collectorId,
          dripMemberId: r.dripMemberId,
          realmMemberId: r.realmMemberId,
          status,
          source: mappedIds.has(r.discordId)
            ? 'VERIFIED_WALLET_LINK'
            : 'EXACT_DISCORD_CREDENTIAL',
          lastResolvedAt: new Date(),
        },
        update: {
          dripMemberId: r.dripMemberId,
          realmMemberId: r.realmMemberId,
          status,
          source: mappedIds.has(r.discordId)
            ? 'VERIFIED_WALLET_LINK'
            : 'EXACT_DISCORD_CREDENTIAL',
          lastResolvedAt: new Date(),
        },
      });
      counts.resolved++;
      const value = r.balance === null ? null : new Prisma.Decimal(r.balance);
      await tx.charmBalance.upsert({
        where: {
          collectorId_realmId_currencyId: {
            collectorId,
            realmId: s.realmId,
            currencyId: s.currencyId,
          },
        },
        create: {
          collectorId,
          realmId: s.realmId,
          currencyId: s.currencyId,
          dripIdentityId: mapping.id,
          balance: value,
          observedAt: value === null ? null : new Date(),
          lastApiSuccessAt: new Date(),
          status: value === null ? 'UNKNOWN' : 'CURRENT',
        },
        update: {
          ...(value === null ? {} : { balance: value, observedAt: new Date() }),
          lastApiSuccessAt: new Date(),
          status: value === null ? 'UNKNOWN' : 'CURRENT',
        },
      });
      if (value !== null) counts.balances++;
    }
    if (sweep)
      await tx.dripSyncState.update({
        where: { realmId: s.realmId },
        data: { memberCursor: identities.at(-1)!.id },
      });
    else
      for (const r of requests)
        await tx.charmRefreshRequest.updateMany({
          where: {
            realmId: r.realmId,
            collectorId: r.collectorId,
            generation: r.generation,
          },
          data: { pending: false },
        });
  });
  return { status: 'SYNCED', ...counts };
}
