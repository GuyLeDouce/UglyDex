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
  const target = await db().collector.findUniqueOrThrow({
    where: { slug: 'admin-fixture-first' },
  });
  await db().collectionJob.upsert({
    where: { collectorId: target.id },
    create: { collectorId: target.id, errorCode: 'SUPPORT_WEB_FAILURE' },
    update: { errorCode: 'SUPPORT_WEB_FAILURE' },
  });
  const response = await fetch(
    base + '/admin?status=ERROR&q=admin-fixture-first',
    { headers: { Cookie: ownerCookie } },
  );
  const html = await response.text();
  check(
    response.ok &&
      html.includes('Awaiting verification') &&
      html.includes('SUPPORT_WEB_FAILURE') &&
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
  const refresh = (
    cookie: string,
    id: string,
    origin = process.env.PUBLIC_BASE_URL!,
  ) =>
    fetch(base + '/api/admin/profiles/refresh', {
      method: 'POST',
      headers: {
        Cookie: cookie,
        Origin: origin,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ id }),
    });
  for (const cookie of ['', walletCookie, wrongDiscord])
    check(
      (await refresh(cookie, target.id)).status === 404,
      'only owner Discord OAuth may refresh an account',
    );
  check(
    (await refresh(ownerCookie, target.id, 'https://untrusted.test')).status ===
      403,
    'admin refresh rejects foreign origins',
  );
  check(
    (await refresh(ownerCookie, 'invalid')).status === 400,
    'admin refresh validates target IDs',
  );
  check(
    html.includes('Refresh account'),
    'owner profile displays manual refresh button',
  );
  const before = await db().collectionJob.findUniqueOrThrow({
    where: { collectorId: target.id },
  });
  const refreshed = await refresh(ownerCookie, target.id);
  const report = await refreshed.json();
  check(
    refreshed.status === 202 &&
      report.messages.some((m: string) => m.startsWith('$CHARM:')),
    'admin refresh reports partial queue results',
  );
  const after = await db().collectionJob.findUniqueOrThrow({
    where: { collectorId: target.id },
  });
  check(
    after.generation === before.generation + 1 && after.errorCode === null,
    'manual refresh queues a new generation for the selected collector',
  );
  check(
    !!(await db().progressionJob.findUnique({
      where: {
        subjectType_subjectId: {
          subjectType: 'COLLECTOR',
          subjectId: target.id,
        },
      },
    })),
    'manual refresh queues collector achievements',
  );
  check(
    (await refresh(ownerCookie, target.id)).status === 429,
    'repeated manual refresh is throttled',
  );
  check(
    (await db().operationalAudit.count({
      where: { action: 'ADMIN_ACCOUNT_REFRESH', subject: target.id },
    })) === 1,
    'manual refresh is audited once',
  );
}
