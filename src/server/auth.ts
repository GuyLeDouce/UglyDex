import 'server-only';
import {
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';
import { cookies } from 'next/headers';
import { verifyMessage, type Hex } from 'viem';
import { createSiweMessage } from 'viem/siwe';
import { db } from './db';
import { readEnv } from './env';
import { normalizeWallet, walletDisplay } from '@/domain/validation';
import { reconcileIdentity } from '@/domain/identity';
import { resolveDiscord } from '@/sync/import-event';
import { markWalletDirty } from '@/sync/provenance';
export const sessionCookie = 'uglydex_session';
export const walletCookie = 'uglydex_wallet_challenge';
export const oauthCookie = 'uglydex_oauth_state';
export class MergeConfirmationRequired extends Error {
  constructor(readonly mergeRequestId: string) {
    super('IDENTITY_REVIEW_REQUIRED');
  }
}
export function authHash(value: string) {
  const secret = readEnv().AUTH_SECRET;
  if (!secret) throw new Error('AUTH_UNCONFIGURED');
  return createHmac('sha256', secret).update(value).digest('hex');
}
export function safeEqual(a: string, b: string) {
  const aa = Buffer.from(a),
    bb = Buffer.from(b);
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}
export function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: readEnv().NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  };
}
export async function currentSession() {
  const token = (await cookies()).get(sessionCookie)?.value;
  if (!token) return null;
  const session = await db().authSession.findUnique({
    where: { tokenHash: authHash(token) },
  });
  return session && session.expiresAt > new Date() ? session : null;
}
export function requireOrigin(request: Request) {
  if (
    request.headers.get('origin') !== new URL(readEnv().PUBLIC_BASE_URL).origin
  )
    throw new Error('ORIGIN_REJECTED');
}
export async function rateLimit(scope: string, subject: string, max = 20) {
  const now = new Date(),
    bucket = Math.floor(now.getTime() / 60000);
  // DB-backed and shared between Railway replicas. No trust in user-supplied forwarded IPs.
  const result = await db().rateLimitBucket.upsert({
    where: { key: authHash(`${scope}:${subject}:${bucket}`) },
    create: {
      key: authHash(`${scope}:${subject}:${bucket}`),
      count: 1,
      expiresAt: new Date((bucket + 2) * 60000),
    },
    update: { count: { increment: 1 } },
  });
  if (result.count > max) throw new Error('RATE_LIMITED');
}
export async function authGuard(request: Request) {
  requireOrigin(request);
  await rateLimit('auth', 'global', 300);
}
export async function walletChallenge(address: string) {
  const wallet = normalizeWallet(address);
  await rateLimit('wallet', wallet, 10);
  const session = await currentSession(),
    token = randomBytes(32).toString('hex'),
    now = new Date(),
    expiresAt = new Date(now.getTime() + 5 * 60000),
    base = new URL(readEnv().PUBLIC_BASE_URL);
  const message = createSiweMessage({
    address: walletDisplay(wallet),
    chainId: 1,
    domain: base.host,
    uri: base.origin,
    version: '1',
    nonce: token,
    issuedAt: now,
    expirationTime: expiresAt,
    statement: session
      ? 'Link this wallet to your UglyDex collector.'
      : 'Sign in to UglyDex. This does not authorize a transaction.',
  });
  await db().authChallenge.create({
    data: {
      id: authHash(token),
      kind: 'wallet',
      subject: wallet,
      message,
      collectorId: session?.collectorId,
      expiresAt,
    },
  });
  (await cookies()).set(walletCookie, token, cookieOptions(300));
  return { message, address: wallet };
}
export async function installSession(
  collectorId: string,
  walletAddress?: string,
  proof?: { method: 'WALLET_SIWE' | 'DISCORD_OAUTH'; credential: string },
) {
  const jar = await cookies(),
    old = jar.get(sessionCookie)?.value,
    token = randomBytes(32).toString('hex');
  await db().$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${collectorId}, 0))`;
    if (
      walletAddress &&
      !(await tx.collectorWallet.findFirst({
        where: { collectorId, walletAddress, status: 'ACTIVE' },
      }))
    )
      throw new Error('INVALID_CHALLENGE');
    if (old)
      await tx.authSession.deleteMany({ where: { tokenHash: authHash(old) } });
    await tx.authSession.create({
      data: {
        tokenHash: authHash(token),
        collectorId,
        authMethod: proof?.method ?? null,
        credentialFingerprint: proof
          ? authHash(`${proof.method}:${proof.credential}`)
          : null,
        expiresAt: new Date(Date.now() + 7 * 86400000),
      },
    });
  });
  jar.set(sessionCookie, token, cookieOptions(7 * 86400));
}
export function usableChallenge(
  challenge: {
    expiresAt: Date;
    consumedAt: Date | null;
    collectorId: string | null;
  },
  sessionCollectorId?: string,
) {
  return (
    !challenge.consumedAt &&
    challenge.expiresAt > new Date() &&
    challenge.collectorId === (sessionCollectorId ?? null)
  );
}
export async function verifyWallet(signature: Hex) {
  const jar = await cookies(),
    token = jar.get(walletCookie)?.value;
  if (!token) throw new Error('INVALID_CHALLENGE');
  const challenge = await db().authChallenge.findUnique({
      where: { id: authHash(token) },
    }),
    session = await currentSession();
  if (
    !challenge ||
    challenge.kind !== 'wallet' ||
    !challenge.message ||
    !usableChallenge(challenge, session?.collectorId)
  )
    throw new Error('INVALID_CHALLENGE');
  await rateLimit('wallet-verify', challenge.subject, 10);
  if (
    !(await verifyMessage({
      address: normalizeWallet(challenge.subject),
      message: challenge.message,
      signature,
    }))
  )
    throw new Error('INVALID_SIGNATURE');
  const result = await db().$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${challenge.subject}, 0))`;
    const used = await tx.authChallenge.updateMany({
      where: {
        id: challenge.id,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { consumedAt: new Date() },
    });
    if (used.count !== 1) throw new Error('INVALID_CHALLENGE');
    const wallet = await tx.collectorWallet.findUnique({
      where: {
        chainId_walletAddress: { chainId: 1, walletAddress: challenge.subject },
      },
    });
    const decision = reconcileIdentity({
      sessionCollectorId: session?.collectorId,
      credentialCollectorId: wallet?.collectorId,
      legacyDiscordIds: [],
      legacyCollectorIds: [],
      revoked: wallet?.status === 'REVOKED',
    });
    if (decision.action === 'REVIEW') {
      await tx.identityReconciliation.upsert({
        where: { dedupeKey: `auth-wallet:${challenge.subject}` },
        create: {
          dedupeKey: `auth-wallet:${challenge.subject}`,
          reason: decision.reason!,
          evidence: {
            wallet: challenge.subject,
            sessionCollectorId: session?.collectorId ?? null,
            credentialCollectorId: wallet?.collectorId ?? null,
          },
        },
        update: {},
      });
      if (
        session &&
        session.authMethod &&
        session.credentialFingerprint &&
        wallet?.status === 'ACTIVE' &&
        wallet.collectorId !== session.collectorId &&
        Date.now() - session.createdAt.getTime() <= 5 * 60_000
      ) {
        await tx.collectorMergeRequest.upsert({
          where: { reviewKey: `auth-wallet:${challenge.subject}` },
          create: {
            survivorCollectorId: session.collectorId,
            absorbedCollectorId: wallet.collectorId,
            credentialType: 'WALLET_SIWE',
            credentialFingerprint: authHash(`wallet:${challenge.subject}`),
            survivorCredentialType: session.authMethod,
            survivorCredentialFingerprint: session.credentialFingerprint,
            reviewKey: `auth-wallet:${challenge.subject}`,
            expiresAt: new Date(Date.now() + 5 * 60_000),
          },
          update: {
            survivorCollectorId: session.collectorId,
            absorbedCollectorId: wallet.collectorId,
            credentialType: 'WALLET_SIWE',
            credentialFingerprint: authHash(`wallet:${challenge.subject}`),
            survivorCredentialType: session.authMethod,
            survivorCredentialFingerprint: session.credentialFingerprint,
            status: 'PENDING_CONFIRMATION',
            expiresAt: new Date(Date.now() + 5 * 60_000),
            confirmedAt: null,
          },
        });
      }
      return null;
    }
    const collectorId =
      decision.collectorId ??
      (
        await tx.collector.create({
          data: { slug: `collector-${randomUUID()}` },
        })
      ).id;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${collectorId}, 0))`;
    if (
      session &&
      !(await tx.authSession.findUnique({
        where: { tokenHash: session.tokenHash },
      }))
    )
      throw new Error('INVALID_CHALLENGE');
    const hasPrimary = await tx.collectorWallet.count({
      where: { collectorId, status: 'ACTIVE', isPrimary: true, chainId: 1 },
    });
    const provedWallet = await tx.collectorWallet.upsert({
      where: {
        chainId_walletAddress: { chainId: 1, walletAddress: challenge.subject },
      },
      create: {
        collectorId,
        chainId: 1,
        walletAddress: challenge.subject,
        checksumAddress: walletDisplay(challenge.subject),
        source: 'SIWE',
        verifiedAt: new Date(),
        isPrimary: !hasPrimary,
      },
      update: {
        lastSeenAt: new Date(),
        ...(!hasPrimary ? { isPrimary: true } : {}),
      },
    });
    await tx.historicalIdentityAttribution.upsert({
      where: { sourceKey: `credential:${provedWallet.id}` },
      create: {
        sourceKey: `credential:${provedWallet.id}`,
        collectorId,
        chainId: 1,
        walletAddress: challenge.subject,
        source: 'SIWE',
        status: 'VERIFIED',
        confidence: 'SIGNED',
        effectiveFrom: provedWallet.verifiedAt,
        evidence: { walletId: provedWallet.id },
      },
      update: {},
    });
    await markWalletDirty(tx, challenge.subject);
    const evidence = await tx.walletLinkEvidence.findMany({
      where: { walletAddress: challenge.subject, legacyVerified: true },
      select: { discordId: true },
    });
    if (evidence.length)
      await tx.identityReconciliation.upsert({
        where: {
          dedupeKey: `legacy-wallet:${challenge.subject}:${collectorId}`,
        },
        create: {
          dedupeKey: `legacy-wallet:${challenge.subject}:${collectorId}`,
          reason: 'DISCORD_PROOF_REQUIRED',
          evidence: {
            collectorId,
            discordIds: [...new Set(evidence.map((e) => e.discordId))],
          },
        },
        update: {},
      });
    return collectorId;
  });
  jar.delete(walletCookie);
  if (!result) {
    const merge = await db().collectorMergeRequest.findFirst({
      where: {
        survivorCollectorId: session?.collectorId,
        reviewKey: `auth-wallet:${challenge.subject}`,
        status: 'PENDING_CONFIRMATION',
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    });
    if (merge) throw new MergeConfirmationRequired(merge.id);
    throw new Error('IDENTITY_REVIEW_REQUIRED');
  }
  await installSession(result, challenge.subject, {
    method: 'WALLET_SIWE',
    credential: challenge.subject,
  });
  // A fresh proof may arrive after this wallet's ownership was indexed. Reconcile
  // current indexed holdings now; historical attribution still uses proof dates.
  const { reconcileCurrentDiscoveries } = await import('./discoveries');
  await reconcileCurrentDiscoveries(result);
  const { requestRefresh } = await import('./refresh');
  if (readEnv().ETH_RPC_URL)
    await requestRefresh(result).catch(() => undefined);
  return db().collector.findUniqueOrThrow({
    where: { id: result },
    select: { slug: true },
  });
}
export async function authenticateDiscord(
  id: string,
  username: string,
  collectorId: string | null,
) {
  const activeSession = await currentSession();
  const result = await db().$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`discord:${id}`}, 0))`;
    const identity = await tx.externalIdentity.findUnique({
      where: { provider_externalId: { provider: 'DISCORD', externalId: id } },
    });
    if (identity && collectorId && identity.collectorId !== collectorId) {
      const reviewKey = `discord:${id}:${collectorId}`;
      await tx.externalIdentity.update({
        where: { id: identity.id },
        data: { username },
      });
      await tx.identityReconciliation.upsert({
        where: { dedupeKey: reviewKey },
        create: {
          dedupeKey: reviewKey,
          reason: 'COLLECTOR_CONFLICT',
          evidence: {
            authenticatedCollectorId: collectorId,
            discordCollectorId: identity.collectorId,
            discordId: id,
          },
        },
        update: {},
      });
      if (
        activeSession?.collectorId === collectorId &&
        !!activeSession.authMethod &&
        !!activeSession.credentialFingerprint &&
        Date.now() - activeSession.createdAt.getTime() <= 5 * 60_000
      ) {
        await tx.externalIdentity.update({
          where: { id: identity.id },
          data: { authenticatedAt: new Date() },
        });
        await tx.collectorMergeRequest.upsert({
          where: { reviewKey },
          create: {
            survivorCollectorId: collectorId,
            absorbedCollectorId: identity.collectorId,
            credentialType: 'DISCORD_OAUTH',
            credentialFingerprint: authHash(`discord:${id}`),
            survivorCredentialType: activeSession.authMethod!,
            survivorCredentialFingerprint: activeSession.credentialFingerprint!,
            reviewKey,
            expiresAt: new Date(Date.now() + 5 * 60_000),
          },
          update: {
            survivorCollectorId: collectorId,
            absorbedCollectorId: identity.collectorId,
            credentialType: 'DISCORD_OAUTH',
            credentialFingerprint: authHash(`discord:${id}`),
            survivorCredentialType: activeSession.authMethod!,
            survivorCredentialFingerprint: activeSession.credentialFingerprint!,
            status: 'PENDING_CONFIRMATION',
            expiresAt: new Date(Date.now() + 5 * 60_000),
            confirmedAt: null,
          },
        });
      }
      return null;
    }
    const record =
      identity ??
      (collectorId
        ? await tx.externalIdentity.create({
            data: { provider: 'DISCORD', externalId: id, collectorId },
          })
        : await resolveDiscord(tx, id));
    await tx.externalIdentity.update({
      where: { id: record.id },
      data: { username, authenticatedAt: new Date() },
    });
    return record.collectorId;
  });
  if (!result) {
    const merge = await db().collectorMergeRequest.findFirst({
      where: {
        survivorCollectorId: collectorId ?? undefined,
        reviewKey: `discord:${id}:${collectorId}`,
        status: 'PENDING_CONFIRMATION',
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    });
    if (merge) throw new MergeConfirmationRequired(merge.id);
    throw new Error('IDENTITY_REVIEW_REQUIRED');
  }
  await installSession(result, undefined, {
    method: 'DISCORD_OAUTH',
    credential: id,
  });
  return db().collector.findUniqueOrThrow({
    where: { id: result },
    select: { slug: true },
  });
}
