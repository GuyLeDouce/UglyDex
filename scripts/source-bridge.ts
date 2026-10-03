import {
  bridgeGroups,
  type BridgeGroup,
} from '../src/integrations/bridge-config';
import { integrationEnv } from '../src/integrations/registry';
import { sourceBridgeServer } from '../src/integrations/bridge-server';
import { closeExternalPools } from '../src/integrations/read-only';
try {
  const group = process.env.BRIDGE_GROUP as BridgeGroup;
  if (!Object.hasOwn(bridgeGroups, group))
    throw new Error('BRIDGE_CONFIGURATION_INVALID');
  if (process.env.DATABASE_URL)
    throw new Error('BRIDGE_UGLYDEX_DATABASE_FORBIDDEN');
  const secret = process.env.BRIDGE_SECRET ?? '';
  if (secret.length < 32) throw new Error('BRIDGE_SECRET_REQUIRED');
  for (const integration of bridgeGroups[group]) {
    const value = process.env[integrationEnv[integration]];
    if (!value) throw new Error('BRIDGE_SOURCE_REQUIRED');
    const url = new URL(value);
    if (
      !['postgres:', 'postgresql:'].includes(url.protocol) ||
      url.username !== 'uglydex_reader' ||
      !url.hostname.endsWith('.railway.internal') ||
      url.searchParams.has('sslmode')
    )
      throw new Error('BRIDGE_PRIVATE_READER_REQUIRED');
  }
  // PostgreSQL stays inside the authenticated encrypted Railway WireGuard mesh.
  // Public client traffic uses Railway HTTPS; never use a raw public DB endpoint.
  const server = sourceBridgeServer(group, secret);
  server.listen(Number(process.env.PORT ?? 3000), '::', () =>
    console.log(JSON.stringify({ event: 'source_bridge.ready', group })),
  );
  const stop = () =>
    server.close(() => {
      void closeExternalPools().then(() => process.exit(0));
    });
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);
} catch {
  console.error('BRIDGE_CONFIGURATION_INVALID');
  process.exitCode = 1;
}
