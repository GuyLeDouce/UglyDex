export type ReconciliationInput = {
  sessionCollectorId?: string;
  credentialCollectorId?: string;
  legacyDiscordIds: string[];
  legacyCollectorIds: string[];
  revoked?: boolean;
};
export function reconcileIdentity(input: ReconciliationInput): {
  action: 'CREATE' | 'USE' | 'REVIEW';
  collectorId?: string;
  reason?: string;
} {
  if (input.revoked) return { action: 'REVIEW', reason: 'REVOKED_WALLET' };
  if (
    input.sessionCollectorId &&
    input.credentialCollectorId &&
    input.sessionCollectorId !== input.credentialCollectorId
  )
    return { action: 'REVIEW', reason: 'COLLECTOR_CONFLICT' };
  // Legacy links never authorize account access, even when unambiguous.
  if (new Set(input.legacyDiscordIds).size > 1)
    return { action: 'REVIEW', reason: 'CONFLICTING_LEGACY_DISCORD' };
  const id = input.sessionCollectorId ?? input.credentialCollectorId;
  if (id) return { action: 'USE', collectorId: id };
  return { action: 'CREATE' };
}
