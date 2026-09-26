import 'dotenv/config';
import { appEnvironment } from '../src/domain/deployment';
const staging = process.argv.includes('--staging');
try {
  if (staging && appEnvironment() !== 'staging')
    throw new Error('STAGING_REQUIRED');
  const base = new URL(process.env.PUBLIC_BASE_URL!);
  if (
    base.protocol !== 'https:' &&
    !['localhost', '127.0.0.1'].includes(base.hostname)
  )
    throw new Error('HTTPS_REQUIRED');
  const probes: [string, number, string?][] = [
    ['/', 200],
    ['/api/health', 200],
    ['/api/ready', 200],
    ['/squigs', 200],
    ['/squig/1', 200],
    ['/squig/0', 404],
    ['/collector/uglydex-smoke-missing-profile', 404],
    ['/admin/production', 404],
    ['/api/admin/collectibles', 404],
    [
      '/api/share?kind=squig&entity=1&ratio=landscape&template=clean',
      200,
      'image/png',
    ],
  ];
  let failed = 0;
  for (const [path, status, mime] of probes) {
    try {
      const r = await fetch(new URL(path, base), {
        redirect: 'manual',
        signal: AbortSignal.timeout(30000),
      });
      const body = new Uint8Array(await r.arrayBuffer());
      const pass =
        r.status === status &&
        (!mime || r.headers.get('content-type')?.includes(mime)) &&
        (!mime || (body[0] === 137 && body[1] === 80));
      console.log(
        `${pass ? 'PASS' : 'FAIL'} ${path.split('?')[0]} status=${r.status}`,
      );
      if (!pass) failed++;
    } catch {
      console.log(`FAIL ${path.split('?')[0]} unavailable`);
      failed++;
    }
  }
  console.log(
    'PENDING authenticated wallet/OAuth and known-private resource checks require reviewed accounts; see device-validation.md',
  );
  if (failed) process.exitCode = 1;
} catch {
  console.error('SMOKE_CONFIGURATION_OR_NETWORK_FAILED');
  process.exitCode = 1;
}
