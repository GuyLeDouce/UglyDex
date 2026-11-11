import { hash } from '@/domain/events';

/** Reuse prior reviewed bot bindings only to request a fresh live DRIP proof.
 * Never treat a new commit, or a hash alone, as proof of a matching economy. */
export function priorDripBindings(
  saved: {
    alignment: unknown;
    alignmentHash: string | null;
    currencyId: string;
    errorCode: string | null;
  },
  configured: { realm: string; currency: string },
) {
  const e = saved.alignment;
  if (
    !e ||
    typeof e !== 'object' ||
    Array.isArray(e) ||
    !saved.alignmentHash ||
    hash(e) !== saved.alignmentHash ||
    saved.currencyId !== configured.currency ||
    saved.errorCode === 'CHARM_ECONOMY_MISMATCH'
  )
    return null;
  const proof = e as Record<string, unknown>;
  if (
    proof.realmHash !== hash(configured.realm) ||
    proof.currencyHash !== hash(configured.currency) ||
    proof.uglyBotRealm !== true ||
    proof.uglyBotCurrency !== true ||
    proof.gauntletRealm !== true ||
    proof.gauntletCurrency !== true ||
    proof.readOnly !== true ||
    !(
      proof.currencyActive === true ||
      (proof.currencyProof === 'EXACT_MEMBER_BALANCE' &&
        proof.currencyObservedInLiveMember === true)
    )
  )
    return null;
  return {
    uglyBotRealm: configured.realm,
    uglyBotCurrency: configured.currency,
    gauntletRealm: configured.realm,
    gauntletCurrency: configured.currency,
  };
}
