import { ZodError } from 'zod';
import { adminActor } from '@/server/admin';
import { requireOrigin, rateLimit } from '@/server/auth';
import { jsonBody } from '@/server/http';
import { updateAdminProfile } from '@/server/admin-profiles';
const headers = { 'Cache-Control': 'no-store' };
const messages: Record<string, string> = {
  PROFILE_CHANGED: 'This profile changed. Reload before saving.',
  PROFILE_MERGED: 'This profile has been merged. Open the surviving profile.',
  OWNER_PROTECTED: 'The owner Discord identity cannot be changed here.',
  LAST_LOGIN: 'Keep at least one wallet or an authenticated Discord login.',
  USERNAME_CONFLICT: 'That username belongs to another profile.',
  WALLET_CONFLICT:
    'That wallet belongs to another profile. It cannot be transferred here.',
  DISCORD_CONFLICT: 'That Discord ID belongs to another profile.',
  DRIP_CONFLICT: 'That DRIP ID belongs to another profile.',
  DRIP_UNCONFIGURED: 'DRIP is not configured for this environment.',
  IDENTITY_REVIEW_REQUIRED:
    'That wallet has an existing profile requiring identity review.',
};
export async function POST(request: Request) {
  try {
    const actor = await adminActor();
    if (!actor)
      return Response.json({ error: 'Not found.' }, { status: 404, headers });
    requireOrigin(request);
    await rateLimit('admin-profile', actor, 30);
    return Response.json(
      await updateAdminProfile(actor, await jsonBody(request)),
      { headers },
    );
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    const prismaCode =
      error && typeof error === 'object' && 'code' in error ? error.code : '';
    const invalid =
      error instanceof ZodError ||
      error instanceof SyntaxError ||
      ['INVALID_BODY', 'BODY_TOO_LARGE'].includes(code);
    const conflict = ['P2002', 'P2034', 'P2025'].includes(String(prismaCode));
    return Response.json(
      {
        error: invalid
          ? 'Check the fields. Use valid IDs, unique addresses, and a reason.'
          : (messages[code] ??
            (conflict
              ? 'A linked record changed or conflicts. Reload and retry.'
              : code === 'ORIGIN_REJECTED'
                ? 'Request origin rejected.'
                : code === 'RATE_LIMITED'
                  ? 'Too many edits. Wait a minute and retry.'
                  : 'Unable to save. Please retry.')),
      },
      {
        status: invalid
          ? 400
          : messages[code] || conflict
            ? 409
            : code === 'ORIGIN_REJECTED'
              ? 403
              : code === 'RATE_LIMITED'
                ? 429
                : 503,
        headers,
      },
    );
  }
}
