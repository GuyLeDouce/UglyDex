import { randomBytes, createHash } from 'node:crypto';
import { cookies } from 'next/headers';
import {
  authGuard,
  authHash,
  currentSession,
  oauthCookie,
  cookieOptions,
} from '@/server/auth';
import { readEnv } from '@/server/env';
import { db } from '@/server/db';
import { authError } from '@/server/http';
export async function POST(request: Request) {
  try {
    await authGuard(request);
    const env = readEnv();
    if (
      !env.DISCORD_CLIENT_ID ||
      !env.DISCORD_CLIENT_SECRET ||
      !env.DISCORD_REDIRECT_URI
    )
      throw new Error('AUTH_UNCONFIGURED');
    const state = randomBytes(32).toString('hex'),
      verifier = randomBytes(32).toString('base64url'),
      session = await currentSession();
    await db().authChallenge.create({
      data: {
        id: authHash(state),
        kind: 'discord',
        subject: verifier,
        collectorId: session?.collectorId,
        expiresAt: new Date(Date.now() + 5 * 60000),
      },
    });
    (await cookies()).set(oauthCookie, state, cookieOptions(300));
    const url = new URL('https://discord.com/oauth2/authorize');
    url.search = new URLSearchParams({
      client_id: env.DISCORD_CLIENT_ID,
      redirect_uri: env.DISCORD_REDIRECT_URI,
      response_type: 'code',
      scope: 'identify',
      state,
      code_challenge: createHash('sha256').update(verifier).digest('base64url'),
      code_challenge_method: 'S256',
    }).toString();
    return Response.redirect(url, 303);
  } catch (error) {
    return authError(error);
  }
}
