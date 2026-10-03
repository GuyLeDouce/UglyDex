import { currentSession, requireOrigin, rateLimit } from '@/server/auth';
import { queueCharmRefresh } from '@/server/drip-sync';
export async function POST(request: Request) {
  try {
    requireOrigin(request);
    const session = await currentSession();
    if (!session)
      return Response.json({ error: 'Sign in required.' }, { status: 401 });
    await rateLimit('charm-refresh', session.collectorId, 5);
    const queued = await queueCharmRefresh(session.collectorId, true);
    return Response.json(
      { queued },
      { status: queued ? 202 : 429, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return Response.json(
      { error: 'Refresh temporarily unavailable.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
