import { ZodError } from 'zod';
import { shareSchema } from '@/domain/sharing';
import { shareCard } from '@/server/sharing';
import { shareLimit, sharePng } from '@/server/share-cache';
import { currentSession } from '@/server/auth';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const headers = {
    'Cache-Control': 'private, no-store, max-age=0',
    Vary: 'Cookie',
    'X-Robots-Tag': 'noindex',
    'X-Content-Type-Options': 'nosniff',
  };
  try {
    const url = new URL(request.url),
      download = url.searchParams.get('download') === '1',
      owner = url.searchParams.get('preview') === '1';
    url.searchParams.delete('download');
    url.searchParams.delete('preview');
    const spec = shareSchema.parse(Object.fromEntries(url.searchParams));
    await shareLimit();
    const session = await currentSession();
    if (owner && !session)
      return new Response('Not available', { status: 404, headers });
    if (session) await shareLimit(session.collectorId, 20);
    const card = await shareCard(
      spec,
      owner ? session?.collectorId : undefined,
    );
    if (!card) return new Response('Not available', { status: 404, headers });
    const bytes = await sharePng(card, spec);
    const fresh = await shareCard(
      spec,
      owner ? session?.collectorId : undefined,
    );
    if (JSON.stringify(fresh) !== JSON.stringify(card))
      return new Response('Share state changed. Please reload.', {
        status: 409,
        headers,
      });
    return new Response(Buffer.from(bytes), {
      headers: {
        ...headers,
        'Content-Type': 'image/png',
        ...(download
          ? {
              'Content-Disposition':
                'attachment; filename="uglydex-' + spec.kind + '.png"',
            }
          : {}),
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : '';
    const status =
      message === 'RATE_LIMITED' || message === 'RENDER_BUSY'
        ? 429
        : e instanceof ZodError
          ? 400
          : 503;
    return new Response(
      status === 429 ? 'Please try again shortly.' : 'Share image unavailable.',
      {
        status,
        headers: {
          ...headers,
          ...(status === 429 ? { 'Retry-After': '60' } : {}),
        },
      },
    );
  }
}
