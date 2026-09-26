import { z } from 'zod';
import { slugSchema } from '@/domain/profile';
import { currentSession, requireOrigin, rateLimit } from '@/server/auth';
import { jsonBody } from '@/server/http';
import { refreshEditionOwnership } from '@/server/editions';
export async function POST(request: Request) {
  const headers = { 'Cache-Control': 'no-store' };
  try {
    requireOrigin(request);
    const s = await currentSession();
    if (!s)
      return Response.json(
        { error: 'Sign in required' },
        { status: 401, headers },
      );
    await rateLimit('edition-check', s.collectorId, 5);
    const { slug } = z
      .object({ slug: slugSchema })
      .strict()
      .parse(await jsonBody(request));
    await refreshEditionOwnership(slug, s.collectorId);
    return Response.json({ ok: true }, { headers });
  } catch {
    return Response.json(
      { error: 'Edition ownership verification unavailable.' },
      { status: 400, headers },
    );
  }
}
