import { adminActor } from '@/server/admin';
import { requireOrigin, rateLimit } from '@/server/auth';
import { jsonBody } from '@/server/http';
import { setWorkerControl } from '@/server/worker-runtime';
export async function POST(request: Request) {
  const headers = { 'Cache-Control': 'no-store' };
  try {
    const actor = await adminActor();
    if (!actor)
      return Response.json({ error: 'Not found' }, { status: 404, headers });
    requireOrigin(request);
    await rateLimit('production-control', actor, 10);
    await setWorkerControl(await jsonBody(request), actor);
    return Response.json({ ok: true }, { headers });
  } catch {
    return Response.json(
      { error: 'Unable to update worker control.' },
      { status: 400, headers },
    );
  }
}
