import { z } from 'zod';
import { authGuard, currentSession } from '@/server/auth';
import { authError, jsonBody } from '@/server/http';
import {
  nextAfterAuthentication,
  setDiscordTracking,
} from '@/server/onboarding';

export async function POST(request: Request) {
  try {
    await authGuard(request);
    const session = await currentSession();
    if (!session) throw new Error('INVALID_CHALLENGE');
    const input = z
      .object({ action: z.enum(['decline', 'enable', 'complete']) })
      .parse(await jsonBody(request));
    if (input.action !== 'complete')
      await setDiscordTracking(session.collectorId, input.action === 'enable');
    const next = await nextAfterAuthentication(session.collectorId);
    return Response.json(
      { next },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return authError(error);
  }
}
