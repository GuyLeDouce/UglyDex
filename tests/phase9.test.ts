import { describe, it, expect } from 'vitest';
import {
  launchDecision,
  launchGates,
  effectiveGateStatus,
  evidenceInput,
  manualGates,
  type GateView,
} from '../src/domain/launch';
import { fingerprintDiff } from '../src/server/replay-proof';
import { environmentSchema } from '../src/server/env';
const all = (status: GateView['status']): GateView[] =>
  launchGates.map(([key, blocking]) => ({
    key,
    blocking,
    status,
    checkedAt: null,
    summary: 'test',
    evidenceHash: null,
  }));
describe('launch evidence policy', () => {
  it('does not mistake configuration for proof', () =>
    expect(launchDecision(all('PENDING')).overall).toBe('NOT_READY'));
  it('accepts fully verified evidence', () =>
    expect(launchDecision(all('VERIFIED')).overall).toBe('READY'));
  it.each(['FAILED', 'DEGRADED'] as const)(
    '%s critical evidence blocks launch',
    (status) => expect(launchDecision(all(status)).overall).toBe('BLOCKED'),
  );
  it('partial critical evidence remains outstanding', () =>
    expect(launchDecision(all('PARTIAL')).blockingPending).toBeGreaterThan(0));
  it('optional unavailable catalogs are warnings', () => {
    const gates = all('VERIFIED');
    gates.find((g) => g.key === 'CUSTOM_MANIFEST')!.status = 'PENDING';
    expect(launchDecision(gates).overall).toBe('READY_WITH_WARNINGS');
  });
  it('replay stability cannot be manually attested', () =>
    expect(manualGates.has('DERIVED_REPLAY_STABLE')).toBe(false));
  it('ownerOf cannot be manually attested', () =>
    expect(manualGates.has('OWNER_OF')).toBe(false));
  it('mismatched environment or revision invalidates evidence', () =>
    expect(effectiveGateStatus('VERIFIED', false, new Date())).toBe('PENDING'));
  it('stale evidence expires', () =>
    expect(effectiveGateStatus('VERIFIED', true, new Date(0))).toBe('PENDING'));
  it('future dated evidence fails closed', () =>
    expect(
      effectiveGateStatus('VERIFIED', true, new Date(Date.now() + 120000)),
    ).toBe('PENDING'));
  it('unknown stored state fails closed', () =>
    expect(effectiveGateStatus('PASS', true, new Date())).toBe('FAILED'));
  it('fresh failed evidence stays failed', () =>
    expect(effectiveGateStatus('FAILED', true, new Date())).toBe('FAILED'));
  it.each([
    'https://private.example/evidence',
    'postgresql://secret@host/db',
    'x?token=secret',
  ])('rejects unsafe evidence reference %s', (reference) =>
    expect(
      evidenceInput.safeParse({
        key: 'BACKUP',
        status: 'VERIFIED',
        reference,
        sha256: 'a'.repeat(64),
      }).success,
    ).toBe(false),
  );
  it('requires content hash', () =>
    expect(
      evidenceInput.safeParse({
        key: 'BACKUP',
        status: 'VERIFIED',
        reference: 'incident-42',
      }).success,
    ).toBe(false));
  it('does not allow operator blocker override', () =>
    expect(
      evidenceInput.safeParse({
        key: 'BACKUP',
        status: 'VERIFIED',
        reference: 'incident-42',
        sha256: 'a'.repeat(64),
        blocking: false,
      }).success,
    ).toBe(false));
  it('table hashes detect changed semantic state even at equal count', () =>
    expect(
      fingerprintDiff(
        { a: { count: 1, sha256: 'x' } },
        { a: { count: 1, sha256: 'y' } },
      ),
    ).toEqual(['a']));
  it('detects added and removed tables', () =>
    expect(
      fingerprintDiff(
        { a: { count: 1, sha256: 'x' } },
        { b: { count: 1, sha256: 'x' } },
      ),
    ).toEqual(['a', 'b']));
  it('identical fingerprints produce no differences', () =>
    expect(
      fingerprintDiff(
        { a: { count: 1, sha256: 'x' } },
        { a: { count: 1, sha256: 'x' } },
      ),
    ).toEqual([]));
  it.each([0, 31, -1])('rejects unsafe pool size %i', (DB_POOL_MAX) =>
    expect(
      environmentSchema.safeParse({
        DATABASE_URL: 'postgresql://test:test@localhost/test',
        DB_POOL_MAX,
      }).success,
    ).toBe(false),
  );
  it('accepts bounded per-service pool and cadence', () =>
    expect(
      environmentSchema.parse({
        DATABASE_URL: 'postgresql://test:test@localhost/test',
        DB_POOL_MAX: 3,
        WORKER_INTERVAL_MS: 30000,
      }).DB_POOL_MAX,
    ).toBe(3));
});
