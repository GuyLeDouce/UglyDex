import 'dotenv/config';
import { operationalIntent } from '../src/domain/deployment';
const paths = ['/', '/squigs', '/squig/1'];
try {
  operationalIntent('capacity');
  const base = new URL(process.env.PUBLIC_BASE_URL!);
  for (const path of [
    process.env.CAPACITY_COLLECTOR_PATH,
    process.env.CAPACITY_GALLERY_PATH,
  ])
    if (
      path &&
      /^\/collector\/[a-z0-9-]+(?:\/gallery\/[a-z0-9-]+)?$/.test(path)
    )
      paths.push(path);
  for (const path of paths) {
    const times: number[] = [];
    let failures = 0;
    for (let i = 0; i < 5; i++) {
      const at = Date.now();
      try {
        const r = await fetch(new URL(path, base), {
          redirect: 'manual',
          signal: AbortSignal.timeout(15000),
        });
        await r.arrayBuffer();
        if (!r.ok) failures++;
      } catch {
        failures++;
      }
      times.push(Date.now() - at);
    }
    times.sort((a, b) => a - b);
    console.log(
      JSON.stringify({
        path,
        requests: 5,
        concurrency: 1,
        p50Ms: times[2],
        p95Ms: times[4],
        failures,
        serverMemory: 'measure through Railway metrics',
      }),
    );
    if (failures) process.exitCode = 1;
  }
  console.log(
    'PENDING authenticated activity/collection capacity requires a reviewed staging session; no credentials embedded',
  );
} catch {
  console.error('CAPACITY_CONFIGURATION_FAILED');
  process.exitCode = 1;
}
