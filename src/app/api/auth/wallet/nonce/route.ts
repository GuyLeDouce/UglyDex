import { z } from 'zod';
import { authGuard, walletChallenge } from '@/server/auth';
import { authError, jsonBody } from '@/server/http';
export async function POST(request: Request) {
  try {
    await authGuard(request);
    const body = z
      .object({ address: z.string().max(42) })
      .parse(await jsonBody(request));
    return Response.json(await walletChallenge(body.address), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return authError(error);
  }
}
