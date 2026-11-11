import { randomBytes } from 'node:crypto';
import { db } from '../../src/server/db';
import { authHash } from '../../src/server/auth';
export async function adminProfileWebTests(
  base: string,
  check: (v: unknown, message: string) => void,
) {
  const owner = process.env.ADMIN_DISCORD_IDS!;
  const admin = await db().collector.create({
    data: {
      slug: 'support-owner-fixture',
      claimedAt: new Date(),
      identities: {
        create: {
          provider: 'DISCORD',
          externalId: owner,
          authenticatedAt: new Date(),
        },
      },
    },
  });
  async function session(method: string, credential: string) {
    const token = randomBytes(32).toString('hex');
    await db().authSession.create({
      data: {
        collectorId: admin.id,
        tokenHash: authHash(token),
        authMethod: method,
        credentialFingerprint: authHash(`${method}:${credential}`),
        expiresAt: new Date(Date.now() + 3600000),
      },
    });
    return `uglydex_session=${token}`;
  }
  const ownerCookie = await session('DISCORD_OAUTH', owner);
  const walletCookie = await session('WALLET_SIWE', '0x' + '1'.repeat(40));
  const wrongDiscord = await session('DISCORD_OAUTH', '444444444444444444');
  for (const cookie of ['', walletCookie, wrongDiscord]) {
    check(
      (await fetch(base + '/admin', { headers: { Cookie: cookie } })).status ===
        404,
      'non-owner-OAuth cannot view admin',
    );
    check(
      (
        await fetch(base + '/api/admin/profiles', {
          method: 'POST',
          headers: {
            Cookie: cookie,
            Origin: process.env.PUBLIC_BASE_URL!,
            'Content-Type': 'application/json',
          },
          body: '{}',
        })
      ).status === 404,
      'non-owner-OAuth cannot edit admin',
    );
  }
  const response = await fetch(
    base + '/admin?status=ACTIVE&q=admin-fixture-first',
    { headers: { Cookie: ownerCookie } },
  );
  const html = await response.text();
  check(
    response.ok &&
      html.includes('Awaiting verification') &&
      html.includes('Edit profile'),
    'owner can filter automatic status and inspect separate support notes',
  );
  check(
    !html.includes('name="status" defaultValue') &&
      !html.includes('Support status'),
    'manual status editor is absent',
  );
  const crossOrigin = await fetch(base + '/api/admin/profiles', {
    method: 'POST',
    headers: {
      Cookie: ownerCookie,
      Origin: 'https://untrusted.test',
      'Content-Type': 'application/json',
    },
    body: '{}',
  });
  check(
    crossOrigin.status === 403,
    'admin support mutation rejects foreign origin',
  );
}
