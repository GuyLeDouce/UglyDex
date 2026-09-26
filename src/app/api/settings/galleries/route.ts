import { log, errorCode } from '@/server/log';
import { currentSession, requireOrigin, rateLimit } from '@/server/auth';
import { saveGallery, deleteGallery } from '@/server/galleries';
import { jsonBody } from '@/server/http';
import { z } from 'zod';
export async function POST(request: Request) {
  try {
    requireOrigin(request);
    const s = await currentSession();
    if (!s)
      return Response.json({ error: 'Sign in required.' }, { status: 401 });
    await rateLimit('galleries', s.collectorId, 20);
    return Response.json(
      await saveGallery(s.collectorId, await jsonBody(request, 131072)),
    );
  } catch (e) {
    const code =
      e instanceof z.ZodError
        ? 'INVALID_FIELDS'
        : e instanceof Error &&
            [
              'INELIGIBLE_SQUIG',
              'EDIT_CONFLICT',
              'GALLERY_LIMIT',
              'ORIGIN_REJECTED',
              'RATE_LIMITED',
            ].includes(e.message)
          ? e.message
          : errorCode(e);
    log('gallery.save_failed', { code });
    return Response.json(
      {
        error:
          (
            {
              INVALID_FIELDS: 'Check the gallery fields.',
              INELIGIBLE_SQUIG:
                'Every Squig must satisfy this gallery’s ownership or discovery mode.',
              EDIT_CONFLICT: 'This gallery changed. Reload before saving.',
              GALLERY_LIMIT: 'You can create up to 12 galleries.',
              ORIGIN_REJECTED: 'Request origin rejected.',
              RATE_LIMITED: 'Please wait before saving again.',
              P2002: 'That gallery slug is already in use.',
            } as Record<string, string>
          )[code] ?? 'Gallery save unavailable. Please try again.',
      },
      { status: 400 },
    );
  }
}
export async function DELETE(request: Request) {
  try {
    requireOrigin(request);
    const s = await currentSession();
    if (!s)
      return Response.json({ error: 'Sign in required.' }, { status: 401 });
    await rateLimit('galleries', s.collectorId, 20);
    const { id } = z.object({ id: z.uuid() }).parse(await jsonBody(request));
    await deleteGallery(s.collectorId, id);
    return Response.json({ ok: true });
  } catch {
    return Response.json(
      { error: 'Unable to delete gallery.' },
      { status: 400 },
    );
  }
}
