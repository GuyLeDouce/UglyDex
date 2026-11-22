import 'server-only';
import { randomBytes, randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { adminActor } from './admin';
import {
  authHash,
  cookieOptions,
  currentSession,
  rateLimit,
  sessionCookie,
} from './auth';
import { db } from './db';

export const workMethod = 'WORK_ADMIN';
const kind = 'WORK_INVITE';
export async function issueWorkCode() {
  const actor = await adminActor();
  const session = await currentSession();
  if (!actor || session?.authMethod !== 'DISCORD_OAUTH')
    throw new Error('Owner sign-in required');
  const code = randomBytes(24).toString('base64url');
  await db().authChallenge.create({
    data: {
      id: authHash(kind + code),
      kind,
      subject: session.collectorId,
      expiresAt: new Date(Date.now() + 600_000),
    },
  });
  return code;
}
export async function redeemWorkCode(code: string) {
  if (!/^[\w-]{32}$/.test(code)) return false;
  await rateLimit('work-login', 'global', 90);
  const raw = randomBytes(32).toString('hex');
  const ok = await db().$transaction(async (tx) => {
    const where = {
      id: authHash(kind + code),
      kind,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    };
    const grant = await tx.authChallenge.findFirst({ where });
    if (
      !grant ||
      !(
        await tx.authChallenge.updateMany({
          where,
          data: { consumedAt: new Date() },
        })
      ).count
    )
      return false;
    // Use a secret-derived UUID as the service identity. A collector cannot
    // obtain its privileges by claiming the same public username.
    const h = authHash('work-account:' + grant.subject);
    const id = [
      h.slice(0, 8),
      h.slice(8, 12),
      '4' + h.slice(13, 16),
      '8' + h.slice(17, 20),
      h.slice(20, 32),
    ].join('-');
    await tx.collector.upsert({
      where: { id },
      update: {},
      create: {
        id,
        slug: 'work-' + randomUUID(),
        displayName: 'ChatGPT Work',
        onboardingCompletedAt: new Date(),
        isPublic: false,
      },
    });
    await tx.authSession.create({
      data: {
        collectorId: id,
        tokenHash: authHash(raw),
        authMethod: workMethod,
        credentialFingerprint: authHash(workMethod + ':' + grant.subject),
        expiresAt: new Date(Date.now() + 3600_000),
      },
    });
    return true;
  });
  if (ok) (await cookies()).set(sessionCookie, raw, cookieOptions(3600));
  return ok;
}
