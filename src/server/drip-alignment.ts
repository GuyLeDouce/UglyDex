import 'server-only';
import { z } from 'zod';
import { hash } from '@/domain/events';
import {
  DripReadError,
  exactDripMembers,
  validateCurrency,
  type DripResponse,
} from '@/integrations/drip';

const memberIdSchema = z.string().regex(/^[a-f0-9]{24}$/i);
const memberSearchSchema = z.object({
  data: z.array(z.unknown()),
  meta: z
    .object({ totalPages: z.number().int().nonnegative().optional() })
    .optional(),
});

export type DripAlignmentBots = {
  uglyBotRealm: string;
  uglyBotCurrency: string;
  gauntletRealm: string;
  gauntletCurrency: string;
};

export type DripAlignmentApi = {
  getRealm(): Promise<DripResponse>;
  getCurrencies(): Promise<DripResponse>;
  findResolvedDripMemberId(): Promise<string | null>;
  searchMembersByDripId(ids: string[]): Promise<DripResponse>;
  waitAfterRealm(): Promise<void>;
  waitBeforeFallback(): Promise<void>;
};

export async function proveDripAlignment(
  bots: DripAlignmentBots,
  configured: { realm: string; currency: string },
  api: DripAlignmentApi,
) {
  const matches = {
    uglyBotRealm: bots.uglyBotRealm === configured.realm,
    uglyBotCurrency: bots.uglyBotCurrency === configured.currency,
    gauntletRealm: bots.gauntletRealm === configured.realm,
    gauntletCurrency: bots.gauntletCurrency === configured.currency,
  };
  if (Object.values(matches).some((matched) => !matched))
    throw new Error('CHARM_ECONOMY_MISMATCH');

  const realm = z.object({ id: z.string() }).parse((await api.getRealm()).body);
  if (realm.id !== configured.realm) throw new Error('CHARM_ECONOMY_MISMATCH');

  await api.waitAfterRealm();
  let currencyProof: 'CURRENCY_CATALOG' | 'EXACT_MEMBER_BALANCE';
  let currencyCatalogAccess: 'AVAILABLE' | 'FORBIDDEN';
  try {
    const currencies = z
      .object({ data: z.array(z.unknown()) })
      .parse((await api.getCurrencies()).body);
    const currency = currencies.data.find(
      (value) =>
        typeof value === 'object' &&
        value !== null &&
        'id' in value &&
        value.id === configured.currency,
    );
    if (!validateCurrency(currency, configured.realm, configured.currency))
      throw new Error('CHARM_ECONOMY_MISMATCH');
    currencyProof = 'CURRENCY_CATALOG';
    currencyCatalogAccess = 'AVAILABLE';
  } catch (error) {
    if (!(error instanceof DripReadError) || error.message !== 'DRIP_HTTP_403')
      throw error;

    const requestedMemberId = await api.findResolvedDripMemberId();
    if (
      !requestedMemberId ||
      !memberIdSchema.safeParse(requestedMemberId).success
    )
      throw new Error('DRIP_ALIGNMENT_MEMBER_PROOF_FAILED');

    await api.waitBeforeFallback();
    const response = await api.searchMembersByDripId([requestedMemberId]);
    let memberProof: ReturnType<typeof exactDripMembers>[number];
    try {
      const body = memberSearchSchema.parse(response.body);
      if (body.data.length !== 1 || (body.meta?.totalPages ?? 1) !== 1)
        throw new Error('AMBIGUOUS_MEMBER_SEARCH');
      [memberProof] = exactDripMembers(
        body.data,
        [requestedMemberId],
        configured.currency,
      );
    } catch {
      throw new Error('DRIP_ALIGNMENT_MEMBER_PROOF_FAILED');
    }
    if (
      memberProof.status !== 'RESOLVED' ||
      memberProof.dripMemberId !== requestedMemberId ||
      memberProof.balance === null
    )
      throw new Error('DRIP_ALIGNMENT_MEMBER_PROOF_FAILED');

    currencyProof = 'EXACT_MEMBER_BALANCE';
    currencyCatalogAccess = 'FORBIDDEN';
  }

  return {
    ...matches,
    realmHash: hash(configured.realm),
    currencyHash: hash(configured.currency),
    currencyProof,
    currencyObservedInLiveMember: currencyProof === 'EXACT_MEMBER_BALANCE',
    currencyCatalogAccess,
    ...(currencyProof === 'CURRENCY_CATALOG' ? { currencyActive: true } : {}),
    readOnly: true,
  };
}
