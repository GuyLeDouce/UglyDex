import { adminActor } from '@/server/admin';
import { requireOrigin, rateLimit } from '@/server/auth';
import { jsonBody } from '@/server/http';
import { squigToken, SQUIGS_CONTRACT } from '@/domain/validation';
import { db } from '@/server/db';
export async function POST(request: Request) {
  try {
    const actor = await adminActor();
    if (!actor) return Response.json({ error: 'Not found' }, { status: 404 });
    requireOrigin(request);
    await rateLimit('rebuild', actor, 5);
    const body = (await jsonBody(request)) as { tokenId?: unknown };
    const tokenId = squigToken(body.tokenId);
    const s = await db().squig.findUniqueOrThrow({
      where: {
        chainId_contractAddress_tokenId: {
          chainId: 1,
          contractAddress: SQUIGS_CONTRACT,
          tokenId,
        },
      },
    });
    await db().squigProvenance.upsert({
      where: { squigId: s.id },
      create: { squigId: s.id },
      update: { dirty: true },
    });
    return Response.json({ status: 'QUEUED' });
  } catch {
    return Response.json(
      { error: 'Unable to queue rebuild.' },
      { status: 400 },
    );
  }
}
