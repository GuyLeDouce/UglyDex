import { describe, expect, it } from 'vitest';
import { hash } from '@/domain/events';
import { priorDripBindings } from '@/server/drip-alignment-revalidation';
const config = { realm: 'realm', currency: 'currency' };
const evidence = {
  uglyBotRealm: true,
  uglyBotCurrency: true,
  gauntletRealm: true,
  gauntletCurrency: true,
  realmHash: hash(config.realm),
  currencyHash: hash(config.currency),
  currencyActive: true,
  readOnly: true,
};
const saved = (alignment: unknown = evidence) => ({
  alignment,
  alignmentHash: hash(alignment),
  currencyId: config.currency,
  errorCode: null,
});
describe('deployment DRIP revalidation admission', () => {
  it('recovers unchanged reviewed bindings for a new live proof', () => {
    expect(priorDripBindings(saved(), config)?.uglyBotRealm).toBe(config.realm);
  });
  it('refuses missing or tampered evidence and revoked economy proof', () => {
    expect(priorDripBindings(saved(null), config)).toBeNull();
    expect(
      priorDripBindings({ ...saved(), alignmentHash: 'wrong' }, config),
    ).toBeNull();
    expect(
      priorDripBindings(
        { ...saved(), errorCode: 'CHARM_ECONOMY_MISMATCH' },
        config,
      ),
    ).toBeNull();
  });
  it('refuses changed realm/currency and unverified bot matches', () => {
    expect(
      priorDripBindings(saved(), { ...config, realm: 'other' }),
    ).toBeNull();
    expect(
      priorDripBindings(saved(), { ...config, currency: 'other' }),
    ).toBeNull();
    expect(
      priorDripBindings(
        saved({ ...evidence, gauntletCurrency: false }),
        config,
      ),
    ).toBeNull();
  });
  it('accepts reviewed exact-member currency evidence without requiring catalog permission', () => {
    expect(
      priorDripBindings(
        saved({
          ...evidence,
          currencyActive: undefined,
          currencyProof: 'EXACT_MEMBER_BALANCE',
          currencyObservedInLiveMember: true,
        }),
        config,
      ),
    ).not.toBeNull();
    expect(
      priorDripBindings(saved({ ...evidence, currencyActive: false }), config),
    ).toBeNull();
  });
});
