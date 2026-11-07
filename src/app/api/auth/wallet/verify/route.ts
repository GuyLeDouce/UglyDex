import { z } from 'zod';
import { nextAfterAuthentication } from '@/server/onboarding';
import { authGuard, currentSession, verifyWallet } from '@/server/auth';
import { authError, jsonBody } from '@/server/http';
export async function POST(request: Request) {
  try {
    await authGuard(request);
    const body = z
      .object({ signature: z.string().regex(/^0x[0-9a-fA-F]{130}$/) })
      .parse(await jsonBody(request));
    const result = await verifyWallet(body.signature as `0x${string}`);
    const session = await currentSession();
    const next = await nextAfterAuthentication(session!.collectorId);
    return Response.json(
      { ...result, next },
      {
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  } catch (error) {
    return authError(error);
  }
}
