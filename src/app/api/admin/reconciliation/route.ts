import { adminActor } from '@/server/admin';
import { requireOrigin, rateLimit } from '@/server/auth';
import { jsonBody } from '@/server/http';
import { decideAttribution } from '@/server/reconciliation';
export async function POST(request: Request) {
  try {
    const actor = await adminActor();
    if (!actor) return Response.json({ error: 'Not found' }, { status: 404 });
    requireOrigin(request);
    await rateLimit('review', actor, 10);
    return Response.json(
      await decideAttribution(actor, await jsonBody(request)),
    );
  } catch {
    return Response.json(
      { error: 'Decision rejected. Check the evidence and dates.' },
      { status: 400 },
    );
  }
}
