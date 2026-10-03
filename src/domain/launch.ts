import { z } from 'zod';
export const gateStatus = z.enum([
  'VERIFIED',
  'PARTIAL',
  'PENDING',
  'DEGRADED',
  'FAILED',
]);
export type GateStatus = z.infer<typeof gateStatus>;
// Policy is code-owned. Operators cannot turn a critical gate into an optional gate.
export const launchGates = [
  ['DATABASE', true],
  ['MIGRATIONS', true],
  ['WEB_DEPLOYMENT', true],
  ['WORKERS', true],
  ['BACKUP', true],
  ['RESTORE_DRILL', true],
  ['ARCHIVE_RPC', true],
  ['START_BLOCK', true],
  ['MINT_COVERAGE', true],
  ['OWNERSHIP_CONTINUITY', true],
  ['OWNER_OF', true],
  ['WALLET_LINKS', false],
  ['UGLYBOT', false],
  ['GAUNTLET', false],
  ['SURVIVAL', false],
  ['IMAGE_SUBMIT', false],
  ['IDENTITY_REVIEW', false],
  ['REATTRIBUTION', true],
  ['ACTIVITY', true],
  ['DUPLICATE_REVIEW', true],
  ['PROGRESSION', true],
  ['COLLECTIONS', true],
  ['DERIVED_REPLAY_STABLE', true],
  ['CHARM_DRIP', true],
  ['HANDOFF', true],
  ['PRIVACY_AUTH', true],
  ['EXTERNAL_OG', false],
  ['REAL_DEVICE_SHARE', true],
  ['CUSTOM_MANIFEST', false],
  ['EDITION_MANIFEST', false],
  ['EDITION_CONTRACTS', false],
  ['HOLDER_TIERS', false],
] as const;
export type GateKey = (typeof launchGates)[number][0];
export const gateKey = z.enum(launchGates.map(([key]) => key));
export const manualGates = new Set<GateKey>([
  'ACTIVITY',
  'WALLET_LINKS',
  'UGLYBOT',
  'GAUNTLET',
  'SURVIVAL',
  'IMAGE_SUBMIT',
  'WEB_DEPLOYMENT',
  'BACKUP',
  'RESTORE_DRILL',
  'IDENTITY_REVIEW',
  'DUPLICATE_REVIEW',
  'HANDOFF',
  'PRIVACY_AUTH',
  'EXTERNAL_OG',
  'REAL_DEVICE_SHARE',
  'CUSTOM_MANIFEST',
  'EDITION_MANIFEST',
  'EDITION_CONTRACTS',
  'HOLDER_TIERS',
]);
export const evidenceInput = z
  .object({
    key: gateKey,
    status: gateStatus,
    // References/hashes only: private notes remain internal and are excluded from exports.
    reference: z
      .string()
      .regex(/^[a-zA-Z0-9][a-zA-Z0-9_.:/-]{2,119}$/)
      .refine((v) => !v.includes('://')),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    notes: z.string().max(1000).default(''),
  })
  .strict();
export type GateView = {
  key: GateKey;
  blocking: boolean;
  status: GateStatus;
  checkedAt: string | null;
  summary: string;
  evidenceHash: string | null;
};
export function launchDecision(gates: GateView[]) {
  const blockers = gates.filter((g) => g.blocking && g.status !== 'VERIFIED');
  const failed = gates.filter((g) => g.status === 'FAILED');
  const warnings = gates.filter((g) => !g.blocking && g.status !== 'VERIFIED');
  return {
    overall: blockers.some((g) => ['FAILED', 'DEGRADED'].includes(g.status))
      ? 'BLOCKED'
      : blockers.length
        ? 'NOT_READY'
        : warnings.length
          ? 'READY_WITH_WARNINGS'
          : 'READY',
    blockingPassed: gates.filter((g) => g.blocking && g.status === 'VERIFIED')
      .length,
    blockingPending: blockers.length,
    warnings: warnings.length,
    failed: failed.length,
  };
}
export function effectiveGateStatus(
  status: string,
  valid: boolean,
  checkedAt: Date,
  now = Date.now(),
): GateStatus {
  if (!valid) return 'PENDING';
  if (now - checkedAt.getTime() > 86400000 || checkedAt.getTime() > now + 60000)
    return 'PENDING';
  return gateStatus.safeParse(status).success
    ? (status as GateStatus)
    : 'FAILED';
}
