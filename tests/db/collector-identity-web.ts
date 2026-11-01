import { randomBytes } from 'node:crypto';
import { privateKeyToAccount } from 'viem/accounts';
import { db } from '../../src/server/db';
import { observe } from '../../src/sync/blockchain';
export async function collectorIdentityWebTests(
  base: string,
  check: (v: unknown, m: string) => void,
) {
  const owner = privateKeyToAccount(`0x${randomBytes(32).toString('hex')}`);
  const other = privateKeyToAccount(`0x${randomBytes(32).toString('hex')}`);
  const address = owner.address.toLowerCase();
  await db().$transaction((tx) =>
    observe(tx, {
      tokenId: 4430,
      wallet: address,
      block: 99100000n,
      blockHash: '0x' + 'e'.repeat(64),
      time: new Date(),
      key: 'identity-http:holder',
      source: 'ownerOf',
    }),
  );
  const discovered = await db().discoveredWallet.findUniqueOrThrow({
    where: { chainId_walletAddress: { chainId: 1, walletAddress: address } },
    include: { collector: true },
  });
  const before = await (
    await fetch(`${base}/collector/${discovered.collector.slug}`)
  ).text();
  check(
    before.includes('UNCLAIMED HOLDER') && before.includes(address),
    'HTTP unclaimed holder renders full public blockchain address',
  );
  check(
    before.includes('Wallet not claimed'),
    'holder profile clearly identifies unclaimed wallet',
  );
  const fieldGuide = await (
    await fetch(`${base}/collector/${discovered.collector.slug}/sets`)
  ).text();
  check(
    fieldGuide.includes('Wallet Field Guide') &&
      !fieldGuide.includes('A field guide built from real discoveries.'),
    'unclaimed holder Field Guide displays tracked wallet progress before login',
  );
  const holdings = await (
    await fetch(`${base}/collector/${discovered.collector.slug}/collection`)
  ).text();
  check(
    holdings.includes('Wallet not claimed') && holdings.includes('4430'),
    'unclaimed collection retains holdings and trust notice',
  );
  const post = (path: string, body: unknown, cookie = '') =>
    fetch(base + path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: process.env.PUBLIC_BASE_URL!,
        Cookie: cookie,
      },
      body: JSON.stringify(body),
    });
  const nonce = await post('/api/auth/wallet/nonce', { address });
  const challenge = await nonce.json();
  const challengeCookie = nonce.headers
    .getSetCookie()
    .find((c) => c.startsWith('uglydex_wallet_challenge='))!
    .split(';')[0];
  const invalid = await post(
    '/api/auth/wallet/verify',
    { signature: await other.signMessage({ message: challenge.message }) },
    challengeCookie,
  );
  check(
    invalid.status === 400 &&
      (await invalid.json()).error === 'INVALID_SIGNATURE',
    'wrong signer cannot claim discovered profile',
  );
  check(
    !(
      await db().collector.findUniqueOrThrow({
        where: { id: discovered.collectorId },
      })
    ).claimedAt,
    'invalid signature leaves holder unclaimed',
  );
  const signature = await owner.signMessage({ message: challenge.message });
  const race = await Promise.all([
    post('/api/auth/wallet/verify', { signature }, challengeCookie),
    post('/api/auth/wallet/verify', { signature }, challengeCookie),
  ]);
  check(
    race.filter((r) => r.ok).length === 1 &&
      race.filter((r) => r.status === 400).length === 1,
    'simultaneous claim consumes a challenge exactly once',
  );
  const success = race.find((r) => r.ok)!;
  const session = success.headers
    .getSetCookie()
    .find((c) => c.startsWith('uglydex_session='))!
    .split(';')[0];
  check(
    (await success.json()).slug === discovered.collector.slug,
    'claim preserves existing public profile URL',
  );
  const linked = await db().collectorWallet.findUniqueOrThrow({
    where: { chainId_walletAddress: { chainId: 1, walletAddress: address } },
  });
  check(
    linked.collectorId === discovered.collectorId && linked.source === 'SIWE',
    'claim preserves UUID and records real signed credential',
  );
  const nonce2 = await post(
    '/api/auth/wallet/nonce',
    { address: other.address },
    session,
  );
  const challenge2 = await nonce2.json();
  const cookie2 = nonce2.headers
    .getSetCookie()
    .find((c) => c.startsWith('uglydex_wallet_challenge='))!
    .split(';')[0];
  const proof2 = await other.signMessage({ message: challenge2.message });
  const missingName = await post(
    '/api/auth/wallet/verify',
    { signature: proof2 },
    `${session}; ${cookie2}`,
  );
  check(
    missingName.status === 400 &&
      (await missingName.json()).error === 'USERNAME_REQUIRED',
    'second wallet requires chosen username',
  );
  const save = await post(
    '/api/settings/profile',
    {
      slug: 'identity-http-owner',
      displayName: '',
      bio: '',
      avatar: '',
      isPublic: true,
      showWallets: true,
      showDiscord: false,
      showUsername: false,
      featuredTokenIds: [],
    },
    session,
  );
  check(save.ok, 'owner edits claimed identity');
  const added = await post(
    '/api/auth/wallet/verify',
    { signature: proof2 },
    `${session}; ${cookie2}`,
  );
  check(
    added.ok,
    'failed username precondition does not consume signed link challenge',
  );
  const addedWallet = await db().collectorWallet.findUniqueOrThrow({
    where: {
      chainId_walletAddress: {
        chainId: 1,
        walletAddress: other.address.toLowerCase(),
      },
    },
  });
  check(
    addedWallet.collectorId === discovered.collectorId &&
      !addedWallet.isPrimary,
    'second signed wallet contributes to same UUID without replacing primary',
  );
  const secret = '909090909090909090';
  await db().externalIdentity.create({
    data: {
      collectorId: discovered.collectorId,
      provider: 'DISCORD',
      externalId: secret,
      authenticatedAt: new Date(),
      username: 'safe-name',
      metadata: { token: 'private-provider-token' },
    },
  });
  const html = await (
    await fetch(base + '/collector/identity-http-owner')
  ).text();
  check(
    !html.includes(secret) && !html.includes('private-provider-token'),
    'public HTML and hydration exclude private identity fields',
  );
  check(
    !html.includes('UNCLAIMED HOLDER'),
    'claimed profile no longer marked unclaimed',
  );
}
