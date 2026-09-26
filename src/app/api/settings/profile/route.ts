import { currentSession, requireOrigin, rateLimit } from '@/server/auth';
import { saveProfile } from '@/server/settings';
import { jsonBody } from '@/server/http';
import { ZodError } from 'zod';
export async function POST(request: Request) {
  try {
    requireOrigin(request);
    const session = await currentSession();
    if (!session)
      return Response.json({ error: 'Sign in required.' }, { status: 401 });
    await rateLimit('profile', session.collectorId, 10);
    return Response.json(
      await saveProfile(session.collectorId, await jsonBody(request)),
    );
  } catch (e) {
    const code = e instanceof Error ? e.message : '';
    return Response.json(
      {
        error:
          e instanceof ZodError
            ? 'Check the profile fields.'
            : code === 'FEATURED_NOT_OWNED'
              ? 'Featured Squigs must be currently owned.'
              : code === 'ORIGIN_REJECTED'
                ? 'Request origin rejected.'
                : code === 'RATE_LIMITED'
                  ? 'Please wait before saving again.'
                  : 'Unable to save. That username may already be taken.',
      },
      { status: 400 },
    );
  }
}
