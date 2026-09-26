import { cookies } from 'next/headers';
import { authGuard, authHash, sessionCookie } from '@/server/auth';
import { db } from '@/server/db';
import { authError } from '@/server/http';
import { readEnv } from '@/server/env';
export async function POST(request: Request) {
  try {
    await authGuard(request);
    const jar = await cookies(),
      token = jar.get(sessionCookie)?.value;
    if (token)
      await db().authSession.deleteMany({
        where: { tokenHash: authHash(token) },
      });
    jar.delete(sessionCookie);
    return Response.redirect(readEnv().PUBLIC_BASE_URL, 303);
  } catch (error) {
    return authError(error);
  }
}
