import { z } from 'zod';
import { adminActor } from '@/server/admin';
import { requireOrigin, rateLimit } from '@/server/auth';
import { jsonBody } from '@/server/http';
import { refreshAdminAccount } from '@/server/admin-refresh';
const headers = { 'Cache-Control': 'no-store' };
export async function POST(request: Request) {
  try {
    const actor = await adminActor();
    if (!actor)
      return Response.json({ error: 'Not found.' }, { status: 404, headers });
    requireOrigin(request);
    await rateLimit('admin-account-refresh', actor, 20);
    const { id } = z.object({ id: z.uuid() }).parse(await jsonBody(request));
    return Response.json(await refreshAdminAccount(actor, id), {
      status: 202,
      headers,
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    const invalid =
      error instanceof z.ZodError ||
      error instanceof SyntaxError ||
      ['INVALID_BODY', 'BODY_TOO_LARGE'].includes(code);
    const throttled = ['RATE_LIMITED', 'REFRESH_THROTTLED'].includes(code);
    return Response.json(
      {
        error: invalid
          ? 'Invalid profile ID.'
          : throttled
            ? 'Please wait two minutes before refreshing this account again.'
            : code === 'PROFILE_UNAVAILABLE'
              ? 'Profile not found or merged.'
              : code === 'ORIGIN_REJECTED'
                ? 'Request origin rejected.'
                : 'Refresh could not finish. Some jobs may already be queued; check the profile status.',
      },
      {
        status: invalid
          ? 400
          : throttled
            ? 429
            : code === 'PROFILE_UNAVAILABLE'
              ? 404
              : code === 'ORIGIN_REJECTED'
                ? 403
                : 503,
        headers,
      },
    );
  }
}
