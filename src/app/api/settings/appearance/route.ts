import { currentSession, requireOrigin, rateLimit } from '@/server/auth';
import { jsonBody } from '@/server/http';
import { saveAppearance } from '@/server/cosmetics';
export async function POST(request: Request) {
  const headers = { 'Cache-Control': 'no-store' };
  try {
    requireOrigin(request);
    const s = await currentSession();
    if (!s)
      return Response.json(
        { error: 'Sign in required' },
        { status: 401, headers },
      );
    await rateLimit('appearance', s.collectorId, 20);
    await saveAppearance(s.collectorId, await jsonBody(request));
    return Response.json({ ok: true }, { headers });
  } catch {
    return Response.json(
      { error: 'Unable to save appearance.' },
      { status: 400, headers },
    );
  }
}
