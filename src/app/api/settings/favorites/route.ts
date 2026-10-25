import { currentSession, requireOrigin, rateLimit } from '@/server/auth';
import { jsonBody } from '@/server/http';
import { setFavorite } from '@/server/favorites';
export async function POST(request: Request) {
  try {
    requireOrigin(request);
    const session = await currentSession();
    if (!session)
      return Response.json({ error: 'Sign in required.' }, { status: 401 });
    await rateLimit('favorites', session.collectorId, 60);
    return Response.json(
      await setFavorite(session.collectorId, await jsonBody(request)),
      {
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    const message =
      code === 'FAVORITE_LIMIT'
        ? 'You can choose up to six favorites. Remove one first.'
        : code === 'FAVORITE_NOT_OWNED'
          ? 'Only Squigs you currently own can be favorites.'
          : code === 'RATE_LIMITED'
            ? 'Please wait a moment before trying again.'
            : 'Could not save your favorite. Please try again.';
    return Response.json({ error: message }, { status: 400 });
  }
}
