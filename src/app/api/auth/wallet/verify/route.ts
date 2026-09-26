import { z } from 'zod';
import { authGuard, verifyWallet } from '@/server/auth';
import { authError, jsonBody } from '@/server/http';
export async function POST(request: Request) {
  try {
    await authGuard(request);
    const body = z
      .object({ signature: z.string().regex(/^0x[0-9a-fA-F]{130}$/) })
      .parse(await jsonBody(request));
    return Response.json(await verifyWallet(body.signature as `0x${string}`), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return authError(error);
  }
}
