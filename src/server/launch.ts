import 'server-only';
import { db } from './db';
import { appEnvironment, databaseFingerprint } from '@/domain/deployment';
import { hash } from '@/domain/events';
import {
  launchGates,
  launchDecision,
  effectiveGateStatus,
  evidenceInput,
  manualGates,
  type GateKey,
  type GateStatus,
  type GateView,
} from '@/domain/launch';
import { assertOperation } from './deployment';
export function launchContext() {
  const value =
    process.env.APP_COMMIT ?? process.env.RAILWAY_GIT_COMMIT_SHA ?? '';
  return {
    environment: appEnvironment(),
    databaseFingerprint: process.env.DATABASE_URL
      ? databaseFingerprint(process.env.DATABASE_URL)
      : 'unconfigured',
    commit: /^[a-f0-9]{7,40}$/.test(value) ? value : 'unknown',
  };
}
export async function recordGate(
  key: GateKey,
  status: GateStatus,
  summary: string,
  evidence: unknown,
  notes = '',
) {
  const context = launchContext();
  await db().$transaction(async (tx) => {
    const data = {
      ...context,
      status,
      summary,
      evidenceHash: hash(evidence),
      notes,
      checkedAt: new Date(),
    };
    await tx.launchGate.upsert({
      where: { key },
      create: { key, ...data },
      update: data,
    });
    await tx.operationalAudit.create({
      data: {
        actor: 'launch:operator',
        action: 'LAUNCH_GATE',
        subject: key,
        detail: {
          status,
          evidenceHash: data.evidenceHash,
          commit: context.commit,
        },
      },
    });
  });
}
export async function attestGate(input: unknown, reviewed: boolean) {
  await assertOperation('launch');
  const data = evidenceInput.parse(input);
  if (!reviewed || !manualGates.has(data.key))
    throw new Error('REVIEWED_MANUAL_GATE_REQUIRED');
  await recordGate(
    data.key,
    data.status,
    'Reviewed operator evidence; details retained privately',
    { reference: data.reference, sha256: data.sha256 },
    data.notes,
  );
}
export async function launchReport() {
  const context = launchContext();
  let rows: Awaited<
    ReturnType<ReturnType<typeof db>['launchGate']['findMany']>
  > = [];
  let storage = 'PENDING';
  let catalogs: { kind: string; id: string; fingerprint: string }[] = [];
  let migration: string | null = null;
  if (process.env.DATABASE_URL)
    try {
      rows = await db().launchGate.findMany();
      const [progression, collections, migrations] = await Promise.all([
        db().progressionRuleset.findMany({
          select: { id: true, fingerprint: true },
          take: 20,
        }),
        db().collectionRuleset.findMany({
          select: { id: true, fingerprint: true },
          take: 20,
        }),
        db().$queryRaw<
          { migration_name: string }[]
        >`SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name DESC LIMIT 1`,
      ]);
      catalogs = [
        ...progression.map((r) => ({ kind: 'progression', ...r })),
        ...collections.map((r) => ({ kind: 'collections', ...r })),
      ];
      migration = migrations[0]?.migration_name ?? null;
      storage = 'VERIFIED';
    } catch {
      storage = 'FAILED';
    }
  const gates: GateView[] = launchGates.map(([key, blocking]) => {
    const row = rows.find((r) => r.key === key);
    const valid =
      !!row &&
      row.environment === context.environment &&
      row.databaseFingerprint === context.databaseFingerprint &&
      row.commit === context.commit &&
      context.commit !== 'unknown';
    const status = row
      ? effectiveGateStatus(row.status, valid, row.checkedAt)
      : 'PENDING';
    return {
      key,
      blocking,
      status,
      checkedAt: row?.checkedAt.toISOString() ?? null,
      summary:
        status === 'PENDING'
          ? 'Current deployment evidence required (absent, expired or changed context)'
          : row!.summary,
      evidenceHash: row?.evidenceHash ?? null,
    };
  });
  if (storage === 'FAILED') {
    const gate = gates.find((g) => g.key === 'DATABASE')!;
    gate.status = 'FAILED';
    gate.summary = 'Launch evidence storage unavailable';
  }
  return {
    ...launchDecision(gates),
    environment: context.environment,
    commit: context.commit,
    storage,
    migration,
    catalogs,
    gates,
  };
}
export function launchText(report: Awaited<ReturnType<typeof launchReport>>) {
  return [
    'UglyDex Launch Readiness',
    `Environment: ${report.environment}; commit: ${report.commit}`,
    `Overall: ${report.overall}`,
    ...report.gates.map(
      (g) =>
        `${g.key}: ${g.status}${g.blocking ? ' [blocking]' : ''} — ${g.summary}`,
    ),
  ].join('\n');
}
