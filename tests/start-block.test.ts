import { describe, expect, it } from 'vitest';
import { decideStartBlock } from '../src/domain/start-block';

const deployment = 25_342_921n;
const validLedger = {
  complete: true,
  count: 4444,
  distinctTokens: 4444,
  minTokenId: 1,
  maxTokenId: 4444,
  earliestMintBlock: 25_349_689n,
  invalidProvenance: 0,
  currentProvenanceGates: true,
};

describe('START_BLOCK evidence policy', () => {
  it('verifies a deployment match with a mint inside the bounded RPC window', () => {
    expect(
      decideStartBlock({
        deploymentBlock: deployment,
        configuredStartBlock: deployment,
        archiveBoundaryValid: true,
        boundedMintBlock: deployment + 12n,
        ledger: null,
      }).status,
    ).toBe('VERIFIED');
  });

  it('uses complete verified stored mint evidence when the bounded probe finds none', () => {
    expect(
      decideStartBlock({
        deploymentBlock: deployment,
        configuredStartBlock: deployment,
        archiveBoundaryValid: true,
        boundedMintBlock: null,
        ledger: validLedger,
      }).status,
    ).toBe('VERIFIED');
  });

  it('does not verify when configured start is after deployment', () => {
    expect(
      decideStartBlock({
        deploymentBlock: deployment,
        configuredStartBlock: deployment + 1n,
        archiveBoundaryValid: true,
        boundedMintBlock: deployment + 12n,
        ledger: validLedger,
      }).status,
    ).not.toBe('VERIFIED');
  });

  it.each([
    ['incomplete ledger', { ...validLedger, complete: false }],
    ['missing token mint', { ...validLedger, distinctTokens: 4443 }],
    ['dirty provenance', { ...validLedger, invalidProvenance: 1 }],
    [
      'invalid owner verification',
      { ...validLedger, currentProvenanceGates: false },
    ],
  ])('does not verify from %s', (_label, ledger) => {
    expect(
      decideStartBlock({
        deploymentBlock: deployment,
        configuredStartBlock: deployment,
        archiveBoundaryValid: true,
        boundedMintBlock: null,
        ledger,
      }).status,
    ).not.toBe('VERIFIED');
  });

  it('fails when the earliest canonical mint predates deployment', () => {
    expect(
      decideStartBlock({
        deploymentBlock: deployment,
        configuredStartBlock: deployment,
        archiveBoundaryValid: true,
        boundedMintBlock: null,
        ledger: { ...validLedger, earliestMintBlock: deployment - 1n },
      }).status,
    ).toBe('FAILED');
  });

  it('fails closed when the archive deployment boundary is inconsistent', () => {
    expect(
      decideStartBlock({
        deploymentBlock: deployment,
        configuredStartBlock: deployment,
        archiveBoundaryValid: false,
        boundedMintBlock: deployment + 12n,
        ledger: validLedger,
      }).status,
    ).toBe('FAILED');
  });
});
