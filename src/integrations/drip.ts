import 'server-only';
import { z } from 'zod';

export const DRIP_BASE = 'https://api.drip.re/api/v1';
export const DRIP_BATCH_SIZE = 25;
const infrastructureId = z.string().regex(/^[a-f0-9]{24}$/i);
const discordId = z.string().regex(/^\d{17,20}$/);
export const decimalBalance = z.string().regex(/^-?\d{1,47}(?:\.\d{1,18})?$/);
export function parseDripJson(text: string): unknown {
  // V8 exposes the original numeric lexeme before floating-point rounding.
  return JSON.parse(
    text,
    (key: string, value: unknown, context?: { source?: string }) => {
      if (key === 'balance' && typeof value === 'number') {
        if (!context?.source) throw new Error('DRIP_EXACT_NUMBER_UNSUPPORTED');
        return decimalBalance.parse(context.source);
      }
      return value;
    },
  );
}
export function rateHeaders(headers: Headers, now = Date.now()) {
  const number = (name: string) => {
    const v = headers.get(name);
    return v !== null && /^\d+$/.test(v) ? Number(v) : null;
  };
  const retry = headers.get('retry-after');
  const retryAt =
    retry === null
      ? null
      : /^\d+(\.\d+)?$/.test(retry)
        ? now + Number(retry) * 1000
        : Date.parse(retry);
  return {
    limit: number('x-ratelimit-limit'),
    remaining: number('x-ratelimit-remaining'),
    resetAt:
      number('x-ratelimit-reset') === null
        ? null
        : number('x-ratelimit-reset')! * 1000,
    window: number('x-ratelimit-window'),
    retryAt: retryAt !== null && Number.isFinite(retryAt) ? retryAt : null,
  };
}
export type DripRate = ReturnType<typeof rateHeaders>;
export type DripResponse = { body: unknown; rate: DripRate };
export class DripReader {
  #realm: string;
  #key: string;
  #fetch: typeof fetch;
  constructor(
    config: { realm: string; key: string },
    fetcher: typeof fetch = fetch,
  ) {
    this.#realm = infrastructureId.parse(config.realm);
    this.#key = z.string().min(1).parse(config.key);
    this.#fetch = fetcher;
  }
  async #get(
    suffix: '' | '/currencies' | '/members/search',
    params?: URLSearchParams,
  ): Promise<DripResponse> {
    const url = new URL(`${DRIP_BASE}/realms/${this.#realm}${suffix}`);
    if (params) url.search = params.toString();
    let response: Response;
    try {
      response = await this.#fetch(url, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.#key}` },
        redirect: 'error',
        cache: 'no-store',
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      throw new DripReadError('DRIP_NETWORK', null);
    }
    const rate = rateHeaders(response.headers);
    if (!response.ok)
      throw new DripReadError(`DRIP_HTTP_${response.status}`, rate);
    // Bound untrusted responses, including chunked bodies without Content-Length.
    let size = 0;
    const chunks: Uint8Array[] = [];
    try {
      const reader = response.body?.getReader();
      if (reader)
        for (;;) {
          const next = await reader.read();
          if (next.done) break;
          size += next.value.length;
          if (size > 2_000_000) {
            await reader.cancel();
            throw new DripReadError('DRIP_RESPONSE_LIMIT', rate);
          }
          chunks.push(next.value);
        }
    } catch (error) {
      if (
        error instanceof DripReadError &&
        error.message === 'DRIP_RESPONSE_LIMIT'
      )
        throw error;
      throw new DripReadError('DRIP_RESPONSE_READ', rate);
    }
    try {
      return {
        body: parseDripJson(Buffer.concat(chunks).toString('utf8')),
        rate,
      };
    } catch {
      throw new DripReadError('DRIP_RESPONSE_INVALID', rate);
    }
  }
  getRealm() {
    return this.#get('');
  }
  getCurrencies(page = 1) {
    return this.#get(
      '/currencies',
      new URLSearchParams({
        limit: '100',
        includeArchived: 'true',
        page: String(z.number().int().min(1).max(100).parse(page)),
      }),
    );
  }
  async searchMembers(ids: string[], page = 1) {
    z.array(discordId).min(1).max(DRIP_BATCH_SIZE).parse(ids);
    return this.#get(
      '/members/search',
      new URLSearchParams({
        type: 'discord-id',
        values: [...new Set(ids)].join(','),
        limit: '100',
        page: String(z.number().int().min(1).max(100).parse(page)),
      }),
    );
  }
  async searchMembersByDripId(ids: string[], page = 1) {
    z.array(infrastructureId).min(1).max(DRIP_BATCH_SIZE).parse(ids);
    return this.#get(
      '/members/search',
      new URLSearchParams({
        type: 'drip-id',
        values: [...new Set(ids)].join(','),
        limit: '100',
        page: String(z.number().int().min(1).max(100).parse(page)),
      }),
    );
  }
}
export class DripReadError extends Error {
  constructor(
    code: string,
    readonly rate: DripRate | null,
  ) {
    super(code);
  }
}
export function validateCurrency(
  value: unknown,
  realm: string,
  currency: string,
) {
  const parsed = z
    .object({
      id: z.string(),
      realmId: z.string().optional(),
      ownership: z.string().optional(),
      archived: z.boolean(),
      archivedAt: z.string().nullable().optional(),
    })
    .safeParse(value);
  if (!parsed.success) return false;
  const c = parsed.data;
  return (
    c.id === currency &&
    !c.archived &&
    !c.archivedAt &&
    (c.realmId !== undefined ? c.realmId === realm : c.ownership === 'OWNED')
  );
}
const memberSchema = z.object({
  id: infrastructureId,
  realmMemberId: z.string().nullable().optional(),
  credentials: z
    .array(
      z.object({
        oauthProvider: z.string().optional(),
        oauthAccountId: z.string().optional(),
      }),
    )
    .default([]),
  balances: z
    .array(z.object({ currencyId: z.string(), balance: decimalBalance }))
    .default([]),
});
export function exactMembers(
  values: unknown[],
  requested: string[],
  currency: string,
) {
  const members = values.map((v) => memberSchema.parse(v));
  return requested.map((discordId) => {
    const matches = members.filter((m) =>
      m.credentials.some(
        (c) => c.oauthProvider === 'discord' && c.oauthAccountId === discordId,
      ),
    );
    const unique = [...new Map(matches.map((m) => [m.id, m])).values()];
    const m = unique.length === 1 ? unique[0] : null;
    const shared =
      m &&
      requested.filter((id) =>
        m.credentials.some(
          (c) => c.oauthProvider === 'discord' && c.oauthAccountId === id,
        ),
      ).length > 1;
    const balances = m?.balances.filter((b) => b.currencyId === currency) ?? [];
    return {
      discordId,
      status:
        unique.length > 1 || balances.length > 1 || shared
          ? 'CONFLICT'
          : m
            ? 'RESOLVED'
            : 'UNRESOLVED',
      dripMemberId: m?.id ?? null,
      realmMemberId: m?.realmMemberId ?? null,
      balance: balances.length === 1 ? balances[0].balance : null,
    } as const;
  });
}

export function exactDripMembers(
  values: unknown[],
  requested: string[],
  currency: string,
) {
  const members = values.map((value) => memberSchema.parse(value));
  return requested.map((dripMemberId) => {
    const matches = members.filter((member) => member.id === dripMemberId);
    const member = matches.length === 1 ? matches[0] : null;
    const balances =
      member?.balances.filter((b) => b.currencyId === currency) ?? [];
    return {
      dripMemberId,
      realmMemberId: member?.realmMemberId ?? null,
      balance: balances.length === 1 ? balances[0].balance : null,
      status:
        matches.length > 1 || balances.length > 1
          ? 'CONFLICT'
          : member
            ? 'RESOLVED'
            : 'UNRESOLVED',
    } as const;
  });
}
