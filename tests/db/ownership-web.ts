import { chromium } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { db } from '../../src/server/db';
import { authHash } from '../../src/server/auth';
import { SQUIGS_CONTRACT } from '../../src/domain/validation';

export async function ownershipWebTests(
  base: string,
  check: (value: unknown, message: string) => void,
  browserTests: boolean,
) {
  const wallet = '0x' + '8b'.repeat(20);
  const unlinked = '0x' + '9c'.repeat(20);
  const now = new Date();
  const collector = await db().collector.create({
    data: {
      slug: 'ownership-review',
      displayName: 'Ownership Privacy Fixture',
      isPublic: true,
      showWallets: false,
    },
  });
  const linked = await db().collectorWallet.create({
    data: {
      collectorId: collector.id,
      chainId: 1,
      walletAddress: wallet,
      source: 'FIXTURE',
      verifiedAt: now,
      status: 'ACTIVE',
    },
  });
  await db().historicalIdentityAttribution.create({
    data: {
      collectorId: collector.id,
      chainId: 1,
      walletAddress: wallet,
      sourceKey: 'ownership-ui:identity',
      source: 'FIXTURE',
      status: 'VERIFIED',
      confidence: 'WALLET_SIGNATURE',
      effectiveFrom: new Date(now.getTime() - 60000),
      evidence: { fixture: true },
    },
  });
  const identity = {
    chainId: 1,
    contractAddress: SQUIGS_CONTRACT,
    tokenId: 4396,
  };
  const squig = await db().squig.upsert({
    where: { chainId_contractAddress_tokenId: identity },
    create: { ...identity, name: 'Squig #4396' },
    update: {},
  });
  await db().squigOwnership.updateMany({
    where: { squigId: squig.id },
    data: { isCurrent: false },
  });
  const ownership = await db().squigOwnership.create({
    data: {
      squigId: squig.id,
      walletAddress: wallet,
      sourceKey: 'ownership-ui:current',
      source: 'FIXTURE',
      blockNumber: 100n,
      blockHash: '0x' + 'a'.repeat(64),
      observedAt: now,
      isCurrent: true,
    },
  });
  await db().squigProvenance.upsert({
    where: { squigId: squig.id },
    create: {
      squigId: squig.id,
      dirty: false,
      complete: true,
      currentWallet: wallet,
    },
    update: { dirty: false, complete: true, currentWallet: wallet },
  });
  const read = async () => {
    const response = await fetch(base + '/squig/4396');
    check(response.ok, 'ownership detail responds successfully');
    const html = await response.text();
    const panel =
      html.match(/<section id="ownership"[\s\S]*?<\/section>/)?.[0] ?? '';
    check(!!panel, 'ownership panel is present');
    return { html, panel };
  };
  const hidden = await read();
  check(
    !hidden.panel.includes('Owned since') && !hidden.panel.includes('Observed'),
    'observation time is never presented as acquisition time',
  );
  await db().walletOwnershipPeriod.create({
    data: {
      id: 'ownership-ui:chain-period',
      squigId: squig.id,
      walletAddress: wallet,
      acquiredAt: new Date('2022-03-14T12:00:00Z'),
      acquisitionEvent: 'ownership-ui:transfer',
    },
  });
  const acquired = await read();
  check(
    acquired.panel.includes('3/14/2022') &&
      acquired.panel.includes('Owned since'),
    'ownership uses the chain holding period rather than recent discovery',
  );
  check(
    acquired.html.indexOf('id="passport"') >
      acquired.html.indexOf('id="ecosystem"'),
    'chain of custody follows ecosystem field notes',
  );
  check(
    acquired.html.includes('Original · Squigs Reloaded · Ugly Labs'),
    'Squig art uses approved attribution caption',
  );
  check(
    hidden.panel.includes(wallet) &&
      !hidden.html.includes(collector.slug) &&
      !hidden.html.includes(collector.displayName!),
    'public holding wallet is visible without leaking opted-out identity in HTML or RSC',
  );
  await db().collector.update({
    where: { id: collector.id },
    data: { showWallets: true },
  });
  const visible = await read();
  check(
    visible.panel.includes(wallet) &&
      visible.panel.includes(`/collector/${collector.slug}`) &&
      visible.panel.includes(collector.displayName!),
    'opted-in verified collector name and link appear alongside the holding wallet',
  );
  await db().collector.update({
    where: { id: collector.id },
    data: { isPublic: false },
  });
  const privateProfile = await read();
  check(
    privateProfile.panel.includes(wallet) &&
      !privateProfile.html.includes(collector.slug),
    'private collector keeps the holding wallet visible without an identity link',
  );
  await db().collector.update({
    where: { id: collector.id },
    data: { isPublic: true },
  });
  await db().squigProvenance.update({
    where: { squigId: squig.id },
    data: { dirty: true },
  });
  const dirty = await read();
  check(
    !dirty.panel.includes('Owned since'),
    'unverified or rebuilding history does not expose a stale acquisition date',
  );
  check(
    dirty.panel.includes(wallet) && !dirty.panel.includes(collector.slug),
    'pending provenance never grants collector attribution but retains the indexed address',
  );
  await db().squigProvenance.update({
    where: { squigId: squig.id },
    data: { dirty: false },
  });
  await db().collectorWallet.update({
    where: { id: linked.id },
    data: { status: 'REVOKED', revokedAt: now },
  });
  const revoked = await read();
  check(
    revoked.panel.includes(wallet) && !revoked.panel.includes(collector.slug),
    'revoked wallet link does not hide chain ownership or identify a collector',
  );
  await db().collectorWallet.update({
    where: { id: linked.id },
    data: { status: 'ACTIVE', revokedAt: null },
  });
  await db().squigOwnership.update({
    where: { id: ownership.id },
    data: { walletAddress: unlinked },
  });
  const unknown = await read();
  check(
    unknown.panel.includes(unlinked) &&
      !unknown.panel.includes(wallet) &&
      !unknown.panel.includes(collector.slug),
    'a holding wallet with no UglyDex account is shown instead of the previous address',
  );
  await db().squigOwnership.update({
    where: { id: ownership.id },
    data: { walletAddress: wallet },
  });
  await db().collector.update({
    where: { id: collector.id },
    data: { showWallets: false },
  });

  if (browserTests) {
    const token = randomBytes(32).toString('hex');
    await db().authSession.create({
      data: {
        collectorId: collector.id,
        tokenHash: authHash(token),
        expiresAt: new Date(Date.now() + 3600000),
      },
    });
    await mkdir('.data/ownership', { recursive: true });
    const browser = await chromium.launch({ headless: true });
    try {
      const publicPage = await browser.newPage();
      for (const width of [1440, 390, 320]) {
        await publicPage.setViewportSize({ width, height: 1000 });
        await publicPage.goto(base + '/squig/4396', {
          waitUntil: 'domcontentloaded',
        });
        const panel = publicPage.locator('#ownership');
        check(
          (await panel.innerText()).includes(wallet),
          `full holding wallet appears at ${width}px`,
        );
        check(
          await publicPage.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          `holding wallet fits ${width}px without overflow`,
        );
        await panel.screenshot({ path: `.data/ownership/wallet-${width}.png` });
      }
      const ownerContext = await browser.newContext({
        viewport: { width: 390, height: 1000 },
      });
      await ownerContext.addCookies([
        { name: 'uglydex_session', value: token, url: base },
      ]);
      const settings = await ownerContext.newPage();
      // The fixture serves HTTP while its configured public origin is HTTPS,
      // matching the existing settings browser tests without weakening CSRF checks.
      await settings.route(base + '/api/settings/profile', async (route) => {
        const response = await route.fetch({
          headers: {
            ...(await route.request().allHeaders()),
            origin: process.env.PUBLIC_BASE_URL!,
          },
        });
        await route.fulfill({ response });
      });
      for (const show of [true, false]) {
        await settings.goto(base + '/settings/profile', {
          waitUntil: 'domcontentloaded',
        });
        const toggle = settings.getByRole('checkbox', {
          name: 'Show my UglyDex identity with linked wallets',
          exact: true,
        });
        check(
          (await toggle.isChecked()) === !show,
          'identity preference persists when settings reload',
        );
        await toggle.setChecked(show);
        const submitted = settings.waitForResponse(
          (response) =>
            response.url() === base + '/api/settings/profile' &&
            response.request().method() === 'POST',
        );
        await settings
          .getByRole('button', { name: 'Save profile', exact: true })
          .click();
        check((await submitted).ok(), 'profile form submission succeeds');
        await settings.getByText('Profile saved.', { exact: true }).waitFor();
        const saved = await db().collector.findUniqueOrThrow({
          where: { id: collector.id },
        });
        check(
          saved.showWallets === show,
          'owner can save identity visibility through the profile form',
        );
        await publicPage.reload({ waitUntil: 'domcontentloaded' });
        check(
          (await publicPage.locator('#ownership').innerText()).includes(wallet),
          'identity toggle never removes the holding address',
        );
        check(
          (await publicPage
            .locator(`#ownership a[href="/collector/${collector.slug}"]`)
            .count()) === (show ? 1 : 0),
          'public ownership identity follows the saved toggle',
        );
      }
      const final = await read();
      check(
        !final.html.includes(collector.slug) &&
          !final.html.includes(collector.displayName!),
        'turning identity off removes protected identity from HTML and RSC',
      );
    } finally {
      await browser.close();
    }
  }
  await db().squigOwnership.update({
    where: { id: ownership.id },
    data: { isCurrent: false },
  });
  const missing = await read();
  check(
    missing.panel.includes('Current ownership has not been indexed.') &&
      !missing.panel.includes(wallet),
    'missing current ownership never displays a previous holding wallet',
  );
}
