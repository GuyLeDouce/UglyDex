import { z } from 'zod';
import { authGuard, currentSession } from '@/server/auth';
import { jsonBody } from '@/server/http';
import { saveWalkthrough } from '@/server/profile-walkthrough';

export async function POST(request: Request) {
  try {
    await authGuard(request);
    const session = await currentSession();
    if (!session)
      return Response.json(
        { error: 'Sign in again to continue.' },
        { status: 401 },
      );
    return Response.json(
      await saveWalkthrough(session.collectorId, await jsonBody(request)),
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    return Response.json(
      {
        error:
          error instanceof z.ZodError
            ? 'Check your answer and try again.'
            : code === 'AVATAR_NOT_OWNED'
              ? 'That Squig is no longer in your collection. Refresh and choose another.'
              : code === 'SETUP_STEP_CHANGED'
                ? 'Your setup has changed in another tab. Refresh to continue.'
                : 'Could not save your answer. Please try again.',
      },
      { status: 400 },
    );
  }
}
