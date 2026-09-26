import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { db } from '../../src/server/db';
import { authHash } from '../../src/server/auth';
export async function phase8WebTests(
  base: string,
  check: (v: unknown, m: string) => void,
  browserTests: boolean,
) {
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
  const headers = { Cookie: 'uglydex_session=' + token };
  const response = await fetch(base + '/admin/production', { headers });
  const html = await response.text();
  check(
    response.ok && html.includes('Subsystem status and alerts'),
    'phase8 admin reliability dashboard',
  );
  check(
    html.includes('Edition') && html.includes('Data quality'),
    'Edition and data quality diagnostics',
  );
  const deny = await fetch(base + '/api/admin/collectibles', {
    method: 'POST',
    headers: {
      ...headers,
      Origin: process.env.PUBLIC_BASE_URL!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      version: 1,
      kind: 'CUSTOM',
      records: [{ status: 'VERIFIED' }],
    }),
  });
  check(deny.status === 400, 'publication requires explicit reviewed header');
  const paths = [
    '/',
    '/squigs',
    '/squig/4307',
    '/collector/phase7-collector',
    '/me/activity',
    '/collection',
  ];
  const metrics = [];
  for (const path of paths) {
    const samples = [];
    for (let i = 0; i < 3; i++) {
      const at = Date.now();
      const r = await fetch(base + path, { headers });
      await r.arrayBuffer();
      check(r.ok, 'capacity fixture route ' + path);
      samples.push(Date.now() - at);
    }
    samples.sort((a, b) => a - b);
    metrics.push({ path, requests: 3, p50Ms: samples[1], p95Ms: samples[2] });
  }
  await writeFile(
    '.data/phase8-web-capacity.json',
    JSON.stringify(
      {
        environment: 'local production build, disposable fixtures',
        at: new Date().toISOString(),
        metrics,
      },
      null,
      2,
    ),
  );
  if (browserTests) {
    const { chromium } = await import('@playwright/test');
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({
        viewport: { width: 390, height: 844 },
      });
      await page
        .context()
        .addCookies([{ name: 'uglydex_session', value: token, url: base }]);
      await page.goto(base + '/admin/production');
      await page
        .getByRole('heading', { name: 'Production command centre' })
        .waitFor();
      check(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
        'production dashboard mobile overflow',
      );
      await page.screenshot({
        path: '.data/phase8-production-mobile.png',
        fullPage: true,
      });
    } finally {
      await browser.close();
    }
  }
}
