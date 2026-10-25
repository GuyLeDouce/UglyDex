import { recalculationErrorCode } from '../src/server/recalculation-error';
import 'dotenv/config';
import { setTimeout as delay } from 'node:timers/promises';
import { recalculateOnStartup } from '../src/server/collection-startup';
import { db } from '../src/server/db';
const stop = new AbortController();
for (const signal of ['SIGINT', 'SIGTERM'])
  process.once(signal, () => stop.abort());
try {
  for (let attempt = 1; attempt <= 5 && !stop.signal.aborted; attempt++) {
    try {
      await recalculateOnStartup(stop.signal);
      break;
    } catch (error) {
      if (stop.signal.aborted) break;
      const code = recalculationErrorCode(error);
      console.error(
        JSON.stringify({
          event: 'collections.startup_retry',
          attempt,
          code,
        }),
      );
      if (
        attempt === 5 ||
        code === 'COLLECTION_STARTUP_BLOCKED' ||
        code === 'DEPLOYMENT_IDENTITY_MISMATCH' ||
        code === 'RULESET_VERSION_BUMP_REQUIRED'
      ) {
        process.exitCode = 1;
        break;
      }
      await delay(Math.min(60000, 5000 * 2 ** (attempt - 1)), undefined, {
        signal: stop.signal,
      }).catch(() => {});
    }
  }
} finally {
  await db().$disconnect();
}
