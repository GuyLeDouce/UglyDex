import { integrationEnv, type Integration } from './registry';
export const bridgeGroups = {
  uglybot: ['links', 'uglybot', 'prizes', 'claims', 'points'],
  gauntlet: ['gauntlet', 'survival'],
  image: ['images', 'submissions'],
} as const;
export type BridgeGroup = keyof typeof bridgeGroups;
export function bridgeGroup(integration: Integration): BridgeGroup {
  return (Object.keys(bridgeGroups) as BridgeGroup[]).find((group) =>
    (bridgeGroups[group] as readonly string[]).includes(integration),
  )!;
}
export function bridgeConfigured(integration: Integration) {
  const prefix = bridgeGroup(integration).toUpperCase();
  return !!(
    process.env[`${prefix}_BRIDGE_URL`] ||
    process.env[`${prefix}_BRIDGE_SECRET`]
  );
}
export function integrationConfigured(integration: Integration) {
  return (
    bridgeConfigured(integration) || !!process.env[integrationEnv[integration]]
  );
}
export function bridgeConfig(integration: Integration) {
  const prefix = bridgeGroup(integration).toUpperCase();
  const url = new URL(process.env[`${prefix}_BRIDGE_URL`] ?? 'invalid');
  const secret = process.env[`${prefix}_BRIDGE_SECRET`] ?? '';
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/' ||
    secret.length < 32
  )
    throw new Error('INVALID_BRIDGE_CONFIGURATION');
  return { url, secret };
}
