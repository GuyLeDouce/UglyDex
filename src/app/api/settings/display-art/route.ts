import { z } from 'zod';
import { currentSession, requireOrigin, rateLimit } from '@/server/auth';
import { saveDisplayPreference } from '@/server/collectibles';
import { jsonBody } from '@/server/http';
import { slugSchema } from '@/domain/profile';
export async function POST(request: Request) {
  const headers = { 'Cache-Control': 'no-store' };
  try {
    requireOrigin(request);
    const session = await currentSession();
    if (!session)
      return Response.json(
        { error: 'Sign in required' },
        { status: 401, headers },
      );
    await rateLimit('display-art', session.collectorId, 20);
    const input = z
      .object({
        tokenId: z.number().int().min(1).max(4444),
        key: slugSchema.nullable(),
      })
      .strict()
      .parse(await jsonBody(request));
    await saveDisplayPreference(session.collectorId, input.tokenId, input.key);
    return Response.json({ ok: true }, { headers });
  } catch {
    return Response.json(
      { error: 'Unable to save display artwork.' },
      { status: 400, headers },
    );
  }
}
