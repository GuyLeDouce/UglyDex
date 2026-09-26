import { cookies } from 'next/headers';
import { z } from 'zod';
import {
  authenticateDiscord,
  authHash,
  currentSession,
  oauthCookie,
  safeEqual,
  usableChallenge,
  rateLimit,
} from '@/server/auth';
import { readEnv } from '@/server/env';
import { db } from '@/server/db';
import { discordId } from '@/domain/validation';
import { authError } from '@/server/http';
export async function GET(request: Request) {
  try {
    const env = readEnv(),
      params = new URL(request.url).searchParams,
      state = params.get('state'),
      code = params.get('code'),
      jar = await cookies(),
      cookie = jar.get(oauthCookie)?.value;
    if (
      !state ||
      state.length > 128 ||
      !code ||
      code.length > 2048 ||
      !cookie ||
      !safeEqual(state, cookie)
    )
      throw new Error('INVALID_CHALLENGE');
    await rateLimit('oauth-callback', 'global', 100);
    const session = await currentSession(),
      challenge = await db().authChallenge.findUnique({
        where: { id: authHash(state) },
      });
    if (
      !challenge ||
      challenge.kind !== 'discord' ||
      !usableChallenge(challenge, session?.collectorId)
    )
      throw new Error('INVALID_CHALLENGE');
    const consumed = await db().authChallenge.updateMany({
      where: {
        id: challenge.id,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { consumedAt: new Date() },
    });
    if (consumed.count !== 1) throw new Error('INVALID_CHALLENGE');
    jar.delete(oauthCookie);
    const response = await fetch('https://discord.com/api/v10/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: env.DISCORD_CLIENT_ID!,
        client_secret: env.DISCORD_CLIENT_SECRET!,
        grant_type: 'authorization_code',
        code,
        redirect_uri: env.DISCORD_REDIRECT_URI!,
        code_verifier: challenge.subject,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error('OAUTH_EXCHANGE_FAILED');
    const token = z
      .object({ access_token: z.string() })
      .parse(await response.json());
    const userResponse = await fetch('https://discord.com/api/v10/users/@me', {
      headers: { Authorization: `Bearer ${token.access_token}` },
      signal: AbortSignal.timeout(10000),
      cache: 'no-store',
    });
    if (!userResponse.ok) throw new Error('OAUTH_IDENTITY_FAILED');
    const user = z
      .object({ id: discordId, username: z.string().max(100) })
      .parse(await userResponse.json());
    await authenticateDiscord(user.id, user.username, challenge.collectorId);
    return Response.redirect(`${env.PUBLIC_BASE_URL}/me`, 303);
  } catch (error) {
    return authError(error);
  }
}
