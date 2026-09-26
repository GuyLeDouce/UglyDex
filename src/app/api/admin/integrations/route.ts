import { inspectIntegrations } from '@/integrations/inspect';
import { safeEqual } from '@/server/auth';
import { internalMetrics } from '@/server/metrics';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const expected = process.env.ADMIN_DIAGNOSTICS_TOKEN,
    provided = request.headers.get('authorization')?.replace(/^Bearer /, '');
  if (!expected || !provided || !safeEqual(expected, provided))
    return Response.json({ error: 'Not found' }, { status: 404 });
  const [integrations, metrics] = await Promise.all([
    inspectIntegrations(),
    internalMetrics(),
  ]);
  return Response.json(
    { integrations, metrics },
    {
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}
