import { charmDirtySchema, verifyDirtySignature } from '@/domain/charm-dirty';
import { jsonBody } from '@/server/http';
import { db } from '@/server/db';
import { rateLimit } from '@/server/auth';
import { dripConfig, queueCharmRefresh } from '@/server/drip-sync';
export async function POST(request: Request) {
  try {
    if (
      new URL(request.url).protocol !== 'https:' ||
      request.headers.has('origin')
    )
      return new Response(null, { status: 403 });
    const payload = charmDirtySchema.parse(await jsonBody(request, 2048));
    const timestamp = request.headers.get('x-charm-timestamp') ?? '',
      nonce = request.headers.get('x-charm-nonce') ?? '',
      signature = request.headers.get('x-charm-signature') ?? '';
    const secret =
      process.env[
        payload.sourceSystem === 'uglybot'
          ? 'CHARM_DIRTY_UGLYBOT_SECRET'
          : 'CHARM_DIRTY_GAUNTLET_SECRET'
      ] ?? '';
    if (!verifyDirtySignature(secret, timestamp, nonce, payload, signature))
      return new Response(null, { status: 401 });
    const c = dripConfig();
    if (
      payload.realmId !== c.DRIP_REALM_ID ||
      payload.currencyId !== c.DRIP_REALM_POINT_ID
    )
      return new Response(null, { status: 409 });
    await rateLimit('charm-dirty', payload.sourceSystem, 60);
    await db().charmDirtyNonce.create({
      data: {
        id: payload.sourceSystem + ':' + nonce,
        expiresAt: new Date(Date.now() + 300000),
      },
    });
    await db().charmDirtyNonce.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    const discord = payload.discordId
      ? await db().externalIdentity.findUnique({
          where: {
            provider_externalId: {
              provider: 'DISCORD',
              externalId: payload.discordId,
            },
          },
          select: { collectorId: true },
        })
      : null;
    const member = payload.dripMemberId
      ? await db().dripIdentity.findUnique({
          where: {
            realmId_dripMemberId: {
              realmId: c.DRIP_REALM_ID,
              dripMemberId: payload.dripMemberId,
            },
          },
          select: { collectorId: true, status: true },
        })
      : null;
    if (
      payload.discordId &&
      payload.dripMemberId &&
      (!discord || !member || discord.collectorId !== member.collectorId)
    )
      return new Response(null, { status: 409 });
    const collectorId =
      discord?.collectorId ??
      (member?.status === 'RESOLVED' ? member.collectorId : null);
    if (collectorId) await queueCharmRefresh(collectorId);
    // Identical response for unknown identity; the callback is only a hint.
    return Response.json(
      { accepted: true },
      { status: 202, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return Response.json(
      { error: 'DIRTY_REQUEST_REJECTED' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
