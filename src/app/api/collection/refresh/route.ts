import { currentSession, requireOrigin } from '@/server/auth';
import { requestRefresh, refreshStatus } from '@/server/refresh';
import { readEnv } from '@/server/env';
export async function GET() {
  if (!(await currentSession()))
    return Response.json({ error: 'Sign in required.' }, { status: 401 });
  return Response.json(await refreshStatus(), {
    headers: { 'Cache-Control': 'no-store' },
  });
}
export async function POST(request: Request) {
  try {
    requireOrigin(request);
    const s = await currentSession();
    if (!s)
      return Response.json({ error: 'Sign in required.' }, { status: 401 });
    if (!readEnv().ETH_RPC_URL)
      return Response.json(
        { error: 'Ownership refresh is awaiting RPC configuration.' },
        { status: 503 },
      );
    return Response.json(await requestRefresh(s.collectorId), { status: 202 });
  } catch (e) {
    return Response.json(
      {
        error:
          e instanceof Error && e.message === 'REFRESH_THROTTLED'
            ? 'Please wait 10 minutes between refresh requests.'
            : 'Refresh could not be queued.',
      },
      { status: 429 },
    );
  }
}
