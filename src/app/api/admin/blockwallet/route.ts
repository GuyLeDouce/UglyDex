import { ZodError } from 'zod';
import { adminActor } from '@/server/admin';
import { requireOrigin, rateLimit } from '@/server/auth';
import { jsonBody } from '@/server/http';
import { changeWalletBlock } from '@/server/wallet-blocks';
const headers = { 'Cache-Control': 'no-store' };
export async function POST(request: Request) {
  try {
    const actor = await adminActor();
    if (!actor)
      return Response.json({ error: 'Not found.' }, { status: 404, headers });
    requireOrigin(request);
    await rateLimit('admin-wallet-block', actor, 30);
    return Response.json(
      await changeWalletBlock(actor, await jsonBody(request, 2048)),
      { headers },
    );
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    const status =
      code === 'RATE_LIMITED'
        ? 429
        : code === 'ORIGIN_REJECTED'
          ? 403
          : code === 'BLOCK_CHANGED'
            ? 409
            : error instanceof ZodError ||
                ['INVALID_BODY', 'BODY_TOO_LARGE'].includes(code) ||
                error instanceof SyntaxError
              ? 400
              : 503;
    return Response.json(
      {
        error:
          code === 'BLOCK_CHANGED'
            ? 'This block changed. Refresh the page before unblocking.'
            : status === 429
              ? 'Too many requests. Please wait and retry.'
              : status === 403
                ? 'Request origin rejected.'
                : status === 400
                  ? 'Enter a valid Ethereum wallet and a reason (1–500 characters).'
                  : 'Unable to update the block list. Please retry.',
      },
      { status, headers },
    );
  }
}
