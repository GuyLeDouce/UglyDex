import { z } from 'zod';
import { currentSession, rateLimit, requireOrigin } from '@/server/auth';
import { jsonBody } from '@/server/http';
import { verifyAndLinkDripMember } from '@/server/charm-link';

const inputSchema = z.object({
  dripUserId: z.string().regex(/^[a-f0-9]{24}$/i),
});

export async function POST(request: Request) {
  try {
    requireOrigin(request);
    const session = await currentSession();
    if (!session)
      return Response.json(
        { error: 'Sign in required.' },
        { status: 401, headers: { 'Cache-Control': 'no-store' } },
      );
    await rateLimit('charm-id-link', session.collectorId, 3);
    const input = inputSchema.parse(await jsonBody(request, 1024));
    const result = await verifyAndLinkDripMember(
      session.collectorId,
      input.dripUserId,
    );
    return Response.json(
      { linked: true, balanceAvailable: result.balanceAvailable },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    if (code === 'RATE_LIMITED')
      return Response.json(
        { error: 'Please wait before trying another DRIP ID.' },
        { status: 429, headers: { 'Cache-Control': 'no-store' } },
      );
    if (error instanceof z.ZodError)
      return Response.json(
        { error: 'Enter a valid DRIP user ID.' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    if (code === 'DRIP_MEMBER_IDENTITY_UNVERIFIED')
      return Response.json(
        { error: 'We could not verify that DRIP account belongs to you.' },
        { status: 403, headers: { 'Cache-Control': 'no-store' } },
      );
    return Response.json(
      { error: 'DRIP verification is temporarily unavailable.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
