import { adminActor } from '@/server/admin';
import { explainActivity } from '@/server/evidence-audit';
import { z } from 'zod';
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const headers = {
    'Cache-Control': 'private, no-store',
    'X-Robots-Tag': 'noindex',
  };
  if (!(await adminActor()))
    return Response.json({ error: 'Not found' }, { status: 404, headers });
  try {
    const { id } = await context.params;
    return Response.json(await explainActivity(z.uuid().parse(id)), {
      headers,
    });
  } catch {
    return Response.json({ error: 'Not found' }, { status: 404, headers });
  }
}
