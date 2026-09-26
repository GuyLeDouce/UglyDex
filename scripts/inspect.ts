import 'dotenv/config';
import { inspectIntegrations } from '../src/integrations/inspect';
import { closeExternalPools } from '../src/integrations/read-only';
try {
  console.log(JSON.stringify(await inspectIntegrations(), null, 2));
} finally {
  await closeExternalPools();
}
