import { z } from 'zod';
import { currentSession, requireOrigin, rateLimit } from '@/server/auth';
import { manageWallet } from '@/server/settings';
import { jsonBody } from '@/server/http';
export async function POST(request: Request) {
  try {
    requireOrigin(request);
    const session = await currentSession();
    if (!session)
      return Response.json({ error: 'Sign in required.' }, { status: 401 });
    await rateLimit('wallet-settings', session.collectorId, 10);
    const data = z
      .object({ walletId: z.uuid(), action: z.enum(['primary', 'revoke']) })
      .parse(await jsonBody(request));
    return Response.json(
      await manageWallet(session.collectorId, data.walletId, data.action),
    );
  } catch (e) {
    return Response.json(
      {
        error:
          e instanceof Error && e.message === 'LAST_CREDENTIAL'
            ? 'Link another wallet or authenticate Discord before revoking your last sign-in method.'
            : 'Wallet change could not be completed.',
      },
      { status: 400 },
    );
  }
}
