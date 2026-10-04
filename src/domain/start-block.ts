export type StartBlockLedgerEvidence = {
  complete: boolean;
  count: number;
  distinctTokens: number;
  minTokenId: number | null;
  maxTokenId: number | null;
  earliestMintBlock: bigint | null;
  invalidProvenance: number;
  currentProvenanceGates: boolean;
};

export function decideStartBlock(input: {
  deploymentBlock: bigint;
  configuredStartBlock: bigint | undefined;
  archiveBoundaryValid: boolean;
  boundedMintBlock: bigint | null;
  ledger: StartBlockLedgerEvidence | null;
}) {
  if (!input.archiveBoundaryValid)
    return { status: 'FAILED' as const, evidence: 'archive boundary mismatch' };
  if (input.configuredStartBlock !== input.deploymentBlock)
    return {
      status: 'PARTIAL' as const,
      evidence: 'configured start differs from deployment',
    };
  if (input.boundedMintBlock !== null) {
    if (input.boundedMintBlock < input.deploymentBlock)
      return {
        status: 'FAILED' as const,
        evidence: 'bounded mint predates deployment',
      };
    return {
      status: 'VERIFIED' as const,
      evidence: 'mint observed in bounded RPC probe',
    };
  }

  const ledger = input.ledger;
  if (
    ledger?.earliestMintBlock !== null &&
    ledger?.earliestMintBlock !== undefined &&
    ledger.earliestMintBlock < input.deploymentBlock
  )
    return {
      status: 'FAILED' as const,
      evidence: 'canonical mint predates deployment',
    };
  const validLedger =
    !!ledger &&
    ledger.complete &&
    ledger.count === 4444 &&
    ledger.distinctTokens === 4444 &&
    ledger.minTokenId === 1 &&
    ledger.maxTokenId === 4444 &&
    ledger.earliestMintBlock !== null &&
    ledger.earliestMintBlock >= input.deploymentBlock &&
    ledger.invalidProvenance === 0 &&
    ledger.currentProvenanceGates;
  return validLedger
    ? {
        status: 'VERIFIED' as const,
        evidence: 'complete verified canonical mint ledger',
      }
    : {
        status: 'PARTIAL' as const,
        evidence: 'complete verified mint ledger required',
      };
}
