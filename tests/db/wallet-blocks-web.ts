import { randomBytes } from 'node:crypto';
import { db } from '../../src/server/db';
import { authHash } from '../../src/server/auth';
import { discoverHolder } from '../../src/server/collector-discovery';
import { chromium } from '@playwright/test';

export async function walletBlockWebTests(
  base: string,
  check: (value: unknown, message: string) => void,
  browserTests: boolean,
) {
  const address = '0x' + 'bd'.repeat(20);
  const holder = await db().$transaction((tx) => discoverHolder(tx, address));
  if (!holder) throw new Error('Expected holder fixture');
  const profile = await db().collector.findUniqueOrThrow({
    where: { id: holder.collectorId },
  });
  const admin = await db().externalIdentity.findUniqueOrThrow({
    where: {
      provider_externalId: {
        provider: 'DISCORD',
        externalId: '333333333333333333',
      },
    },
  });
  const token = randomBytes(32).toString('hex');
  await db().authSession.create({
    data: {
      collectorId: admin.collectorId,
      tokenHash: authHash(token),
      expiresAt: new Date(Date.now() + 3600000),
    },
  });
  const cookie = `uglydex_session=${token}`;
  const post = (
    body: unknown,
    session = cookie,
    origin = process.env.PUBLIC_BASE_URL!,
  ) =>
    fetch(base + '/api/admin/blockwallet', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: session,
        Origin: origin,
      },
      body: JSON.stringify(body),
    });
  const input = {
    action: 'block',
    walletAddress: address,
    reason: 'Admin-only block test',
  };
  check(
    (await fetch(base + '/admin/blockwallet')).status === 404,
    'HTTP moderation page is admin only',
  );
  check(
    (await post(input, '')).status === 404,
    'HTTP anonymous moderation mutation denied',
  );
  check(
    (await post(input, cookie, 'https://untrusted.test')).status === 403,
    'HTTP cross-origin moderation mutation denied',
  );
  check((await post(input)).ok, 'HTTP admin can block wallet');
  const html = await (
    await fetch(base + '/admin/blockwallet', { headers: { Cookie: cookie } })
  ).text();
  check(
    html.includes(address) &&
      html.includes(input.reason) &&
      html.includes('Unblock wallet'),
    'HTTP admin list displays block and unblock control',
  );
  for (const suffix of ['', '/sets', '/collection'])
    check(
      (await fetch(`${base}/collector/${profile.slug}${suffix}`)).status ===
        404,
      'blocked profile subroute hidden: ' + suffix,
    );
  if (browserTests) {
    const browser = await chromium.launch({ headless: true });
    try {
      const context = await browser.newContext();
      await context.addCookies([
        { name: 'uglydex_session', value: token, url: base },
      ]);
      const page = await context.newPage();
      await page.goto(base + '/admin/blockwallet', {
        waitUntil: 'networkidle',
      });
      check(
        await page
          .getByRole('heading', { name: 'Blocked wallets', exact: true })
          .isVisible(),
        'browser admin moderation page renders',
      );
      for (const width of [1440, 390, 320]) {
        await page.setViewportSize({ width, height: 900 });
        check(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          `admin block list fits ${width}px`,
        );
      }
    } finally {
      await browser.close();
    }
  }
  const block = await db().blockedWallet.findUniqueOrThrow({
    where: { chainId_walletAddress: { chainId: 1, walletAddress: address } },
  });
  check(
    (
      await post({
        action: 'unblock',
        walletAddress: address,
        blockedAt: block.createdAt.toISOString(),
      })
    ).ok,
    'HTTP admin can unblock wallet',
  );
  check(
    (await fetch(`${base}/collector/${profile.slug}`)).ok,
    'HTTP previously public profile restored',
  );
  await db().authSession.delete({ where: { tokenHash: authHash(token) } });
  await db().discoveredWallet.delete({
    where: { chainId_walletAddress: { chainId: 1, walletAddress: address } },
  });
  await db().collector.delete({ where: { id: profile.id } });
  await db().collectionJob.deleteMany({ where: { collectorId: profile.id } });
  await db().progressionJob.deleteMany({ where: { subjectId: profile.id } });
}
