import { z } from 'zod';
import { adminActor } from '@/server/admin';
import { requireOrigin, rateLimit } from '@/server/auth';
import { jsonBody } from '@/server/http';
import { importCollectibles, exportCollectibles } from '@/server/collectibles';
const headers = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' };
export async function GET(request: Request) {
  if (!(await adminActor()))
    return Response.json({ error: 'Not found' }, { status: 404, headers });
  const kind = z
    .enum(['CUSTOM', 'EDITION'])
    .safeParse(new URL(request.url).searchParams.get('kind'));
  if (!kind.success)
    return Response.json({ error: 'Invalid kind' }, { status: 400, headers });
  return Response.json(await exportCollectibles(kind.data), {
    headers: {
      ...headers,
      'Content-Disposition': `attachment; filename="uglydex-${kind.data.toLowerCase()}-catalog.json"`,
    },
  });
}
export async function POST(request: Request) {
  try {
    const actor = await adminActor();
    if (!actor)
      return Response.json({ error: 'Not found' }, { status: 404, headers });
    requireOrigin(request);
    await rateLimit('collectibles-admin', actor, 5);
    const input = await jsonBody(request, 100000);
    if (!Array.isArray(input?.records) || input.records.length > 10)
      throw new Error('WEB_MANIFEST_LIMIT');
    return Response.json(await importCollectibles(input, actor), { headers });
  } catch (e) {
    const allowed = [
      'EDIT_CONFLICT',
      'RETIRED_RECORD_IMMUTABLE',
      'UNKNOWN_SQUIG',
      'IMMUTABLE_ARTWORK_CHANGED',
      'INVALID_ARTWORK_RESPONSE',
      'ARTWORK_TOO_LARGE',
      'UNSUPPORTED_ARTWORK',
      'DUPLICATE_MANIFEST_KEY',
      'CUSTOM_TOKEN_IMMUTABLE',
      'WEB_MANIFEST_LIMIT',
    ];
    const code =
      e instanceof Error && allowed.includes(e.message)
        ? e.message
        : 'INVALID_OR_UNAVAILABLE_CATALOG';
    return Response.json({ error: code }, { status: 400, headers });
  }
}
