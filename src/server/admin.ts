import 'server-only';
import { currentSession, authHash } from './auth';
import { configuredAdminOwner } from '@/domain/admin-profiles';
import { db } from './db';
import { readEnv } from './env';
export async function adminActor() {
  const env = readEnv();
  const owner = configuredAdminOwner(
    env.ADMIN_OWNER_DISCORD_ID,
    env.ADMIN_DISCORD_IDS,
  );
  if (!owner) return null;
  const s = await currentSession();
  if (s?.authMethod === 'WORK_ADMIN') {
    const issuer = await db().externalIdentity.findUnique({
      where: {
        provider_externalId: { provider: 'DISCORD', externalId: owner },
      },
      select: { collectorId: true, authenticatedAt: true },
    });
    return issuer?.authenticatedAt &&
      s.credentialFingerprint === authHash('WORK_ADMIN:' + issuer.collectorId)
      ? 'work:' + s.collectorId
      : null;
  }
  if (
    !s ||
    s.authMethod !== 'DISCORD_OAUTH' ||
    s.credentialFingerprint !== authHash(`DISCORD_OAUTH:${owner}`)
  )
    return null;
  const identity = await db().externalIdentity.findFirst({
    where: {
      collectorId: s.collectorId,
      provider: 'DISCORD',
      externalId: owner,
      authenticatedAt: { not: null },
    },
  });
  return identity ? `collector:${s.collectorId}` : null;
}
