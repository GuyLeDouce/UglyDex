import { z } from 'zod';
import { authGuard, currentSession, installSession } from '@/server/auth';
import { confirmCollectorMerge } from '@/server/collector-merge';
import { authError, jsonBody } from '@/server/http';
import { db } from '@/server/db';

export async function POST(request: Request) {
  try {
    await authGuard(request);
    const body = z
      .object({ requestId: z.string().uuid() })
      .parse(await jsonBody(request));
    const session = await currentSession();
    if (!session) throw new Error('INVALID_CHALLENGE');
    const { collectorId } = await confirmCollectorMerge(
      body.requestId,
      session.collectorId,
    );
    await installSession(collectorId);
    const collector = await db().collector.findUniqueOrThrow({
      where: { id: collectorId },
      select: { slug: true },
    });
    return Response.json(
      { ok: true, slug: collector.slug },
      {
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  } catch (error) {
    return authError(error);
  }
}
