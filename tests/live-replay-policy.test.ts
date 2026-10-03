import { describe, expect, it } from 'vitest';
import { replayPolicy, type ReplayBoundary } from '../src/domain/replay-policy';

const boundary = (): ReplayBoundary => ({
  frozenStatus: 'VERIFIED',
  compatible: true,
  exactInput: true,
  exactDerived: true,
  attribution: 0,
  progression: 0,
  collections: 0,
  dirty: 0,
  failed: 0,
  ingestionHealthy: true,
  convergence: 'ABSENT',
});
describe('frozen determinism and current live convergence', () => {
  it('accepts identical inputs and outputs', () =>
    expect(replayPolicy(boundary())).toBe('VERIFIED'));
  it('accepts advanced inputs only with independent convergence', () =>
    expect(
      replayPolicy({ ...boundary(), exactInput: false, convergence: 'MATCH' }),
    ).toBe('VERIFIED'));
  it('requires convergence for advanced input', () =>
    expect(replayPolicy({ ...boundary(), exactInput: false })).toBe('PENDING'));
  it.each([
    'ruleset',
    'derivation revision',
    'catalog',
    'environment',
    'database',
    'stale evidence',
  ])('rejects incompatible %s', () =>
    expect(
      replayPolicy({ ...boundary(), compatible: false, convergence: 'MATCH' }),
    ).toBe('PENDING'),
  );
  it.each([
    'attribution',
    'progression',
    'collections',
    'dirty',
    'failed',
  ] as const)('rejects nonzero %s', (key) =>
    expect(
      replayPolicy({ ...boundary(), [key]: 1, convergence: 'MATCH' }),
    ).not.toBe('VERIFIED'),
  );
  it('fails semantic recomputation differences', () =>
    expect(
      replayPolicy({
        ...boundary(),
        exactInput: false,
        convergence: 'MISMATCH',
      }),
    ).toBe('FAILED'));
  it('rejects stale materialized state even when inputs are unchanged', () =>
    expect(replayPolicy({ ...boundary(), exactDerived: false })).not.toBe(
      'VERIFIED',
    ));
  it('does not revive a latest failed frozen replay', () =>
    expect(
      replayPolicy({
        ...boundary(),
        frozenStatus: 'FAILED',
        convergence: 'MATCH',
      }),
    ).toBe('FAILED'));
  it('requires healthy ingestion', () =>
    expect(replayPolicy({ ...boundary(), ingestionHealthy: false })).toBe(
      'PENDING',
    ));
  it('does not require convergence for existing excluded operational clocks', () =>
    expect(replayPolicy(boundary())).toBe('VERIFIED'));
  it('requires convergence for a source semantic correction', () =>
    expect(
      replayPolicy({ ...boundary(), exactInput: false, exactDerived: true }),
    ).toBe('PENDING'));
});
