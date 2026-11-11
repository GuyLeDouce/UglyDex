import { randomBytes, randomUUID } from 'node:crypto';
import { db } from '../../src/server/db';
import { authHash } from '../../src/server/auth';
import { catalogScope } from '../../src/server/collections';

export async function profileWalkthroughWebTests(
  base: string,
  check: (value: unknown, message: string) => void,
) {
  const address = '0x' + randomBytes(20).toString('hex');
  const c = await db().collector.create({
    data: {
      slug: `collector-${randomUUID()}`,
      claimedAt: new Date(),
      discordTrackingConsent: true,
      wallets: {
        create: {
          chainId: 1,
          walletAddress: address,
          checksumAddress: address,
          source: 'SIWE',
          verifiedAt: new Date(),
          isPrimary: true,
        },
      },
      identities: {
        create: {
          provider: 'DISCORD',
          externalId: '811111111111111118',
          authenticatedAt: new Date(),
        },
      },
    },
  });
  for (const tokenId of [4301, 4302]) {
    const squig = await db().squig.upsert({
      where: { chainId_contractAddress_tokenId: { ...catalogScope, tokenId } },
      create: { ...catalogScope, tokenId, mawRank: tokenId - 4300 },
      update: { mawRank: tokenId - 4300 },
    });
    await db().squigOwnership.create({
      data: {
        squigId: squig.id,
        walletAddress: address,
        source: 'fixture',
        sourceKey: `walkthrough:${tokenId}`,
        blockNumber: 1n,
        blockHash: 'fixture',
        isCurrent: true,
      },
    });
  }
  const token = randomBytes(32).toString('hex');
  await db().authSession.create({
    data: {
      collectorId: c.id,
      tokenHash: authHash(token),
      expiresAt: new Date(Date.now() + 3600000),
    },
  });

  const headers = {
    Cookie: 'uglydex_session=' + token,
    Origin: process.env.PUBLIC_BASE_URL!,
    'Content-Type': 'application/json',
  };
  const post = (body: object) =>
    fetch(base + '/api/onboarding/profile', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
  const page = () =>
    fetch(base + '/onboarding', { headers }).then((r) => r.text());
  check(
    (await page()).includes('What shall we call you?'),
    'new collector starts with name',
  );
  check(
    (await post({ action: 'sharing', share: true })).status === 400,
    'HTTP cannot skip setup',
  );
  check(
    (await post({ action: 'name', name: 'Fresh Ugly' })).ok,
    'HTTP saves collector name',
  );
  check(
    (await page()).includes('do you know your DRIP ID?'),
    'reload resumes at mandatory DRIP',
  );
  check(
    (await post({ action: 'avatar', tokenId: 4302 })).status === 400,
    'HTTP cannot skip DRIP verification',
  );
  // Upstream identity verification is covered separately; simulate its persisted result.
  await db().dripIdentity.create({
    data: {
      collectorId: c.id,
      realmId: 'd'.repeat(24),
      dripMemberId: 'e'.repeat(24),
      status: 'RESOLVED',
    },
  });
  check(
    (await page()).includes('Your highest ranked Squig'),
    'verified DRIP proceeds to owned PFP',
  );
  check(
    (await post({ action: 'avatar', tokenId: 4302 })).ok,
    'HTTP saves currently owned PFP',
  );
  check(
    (await page()).includes('Fresh Ugly!'),
    'sharing prompt includes saved collector name',
  );
  const finish = await post({ action: 'sharing', share: true });
  const result = await finish.json();
  const finished = await db().collector.findUniqueOrThrow({
    where: { id: c.id },
  });
  check(
    finish.ok &&
      result.complete &&
      finished.showUsername &&
      finished.collectionVisibility === 'FULL' &&
      finished.avatar?.endsWith('/4302.png') &&
      finished.onboardingCompletedAt,
    'HTTP persists PFP and public sharing at completion',
  );
  check(
    result.next === `/collector/${finished.slug}`,
    'Explore targets collector page',
  );
  const returning = await fetch(base + '/onboarding', {
    headers,
    redirect: 'manual',
  });
  check(
    returning.headers.get('location') === '/me',
    'completed collector bypasses walkthrough',
  );
}
