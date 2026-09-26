import 'dotenv/config';
import { validateIntegrations } from '../src/integrations/validate';
import { closeExternalPools } from '../src/integrations/read-only';
import { db } from '../src/server/db';
try {
  console.log(JSON.stringify(await validateIntegrations(), null, 2));
} catch {
  console.error('INTEGRATION_VALIDATION_FAILED');
  process.exitCode = 1;
} finally {
  await closeExternalPools();
  await db().$disconnect();
}
