import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BridgeAuthenticator,
  bridgeSignature,
  signBridge,
} from '@/integrations/bridge-auth';
import { createBridgeHandler } from '@/integrations/bridge-server';
import { bridgeRequest } from '@/integrations/bridge-client';
import { bridgeConfigured, bridgeConfig } from '@/integrations/bridge-config';
import { effectivePage, pageInput } from '@/integrations/bridge-protocol';
import { sourceSchema } from '@/integrations/source-schema';
import { sourceQueries } from '@/integrations/queries';
import { safeSourceRole } from '@/integrations/permissions';
const secret = 'bridge-test-secret-'.repeat(4);
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});
function signed(body = '{}', path = '/v1/feeds/duels/page', time = Date.now()) {
  return new Request('https://bridge.example' + path, {
    method: 'POST',
    body,
    headers: signBridge(secret, 'POST', path, body, time),
  });
}
describe('bridge authentication and bounded API', () => {
  it('accepts a valid HMAC exactly once', () => {
    const auth = new BridgeAuthenticator(secret),
      r = signed();
    expect(auth.verify('POST', new URL(r.url).pathname, '{}', r.headers)).toBe(
      true,
    );
    expect(auth.verify('POST', new URL(r.url).pathname, '{}', r.headers)).toBe(
      false,
    );
  });
  it.each(['body', 'path', 'method', 'signature'])(
    'rejects tampered %s',
    (field) => {
      const auth = new BridgeAuthenticator(secret),
        r = signed();
      if (field === 'signature')
        r.headers.set('x-bridge-signature', '0'.repeat(64));
      expect(
        auth.verify(
          field === 'method' ? 'GET' : 'POST',
          field === 'path' ? '/v1/feeds/maw/page' : new URL(r.url).pathname,
          field === 'body' ? '{"limit":500}' : '{}',
          r.headers,
        ),
      ).toBe(false);
    },
  );
  it.each([-60001, 60001])('rejects timestamp outside skew %s', (offset) => {
    const now = Date.now(),
      r = signed('{}', undefined, now + offset);
    expect(
      new BridgeAuthenticator(secret).verify(
        'POST',
        new URL(r.url).pathname,
        '{}',
        r.headers,
        now,
      ),
    ).toBe(false);
  });
  it('rejects malformed signature without invoking a query', async () => {
    const dispatch = vi.fn();
    const r = signed();
    r.headers.set('x-bridge-signature', 'bad');
    expect(
      (await createBridgeHandler('uglybot', secret, dispatch)(r)).status,
    ).toBe(401);
    expect(dispatch).not.toHaveBeenCalled();
  });
  it('binds signatures to the body hash and protocol', () => {
    const a = bridgeSignature(
      secret,
      'POST',
      '/v1/feeds/duels/page',
      '123',
      'abc',
      '{}',
    );
    expect(a).not.toBe(
      bridgeSignature(
        secret,
        'POST',
        '/v1/feeds/duels/page',
        '123',
        'abc',
        '[]',
      ),
    );
  });
  it('exposes no rows or credentials in public health', async () => {
    const r = await createBridgeHandler(
      'uglybot',
      secret,
    )(new Request('https://bridge.example/healthz'));
    expect(await r.json()).toEqual({ ok: true });
  });
  it('redacts unexpected source errors as service failures', async () => {
    const dispatch = async () => {
      throw new Error('postgres://password@private source row');
    };
    const response = await createBridgeHandler(
      'uglybot',
      secret,
      dispatch,
    )(signed());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      ok: false,
      code: 'SOURCE_UNAVAILABLE',
    });
  });
  it('rejects unknown feeds and cross-group feeds', async () => {
    for (const path of [
      '/v1/feeds/session/page',
      '/v1/feeds/runs/page',
      '/v1/query',
    ])
      expect(
        (await createBridgeHandler('uglybot', secret)(signed('{}', path)))
          .status,
      ).toBe(404);
  });
  it('rejects arbitrary query parameters', async () => {
    const r = signed('{}', '/v1/feeds/duels/page?sql=SELECT');
    expect((await createBridgeHandler('uglybot', secret)(r)).status).toBe(400);
  });
  it('bounds request bodies', async () =>
    expect(
      (await createBridgeHandler('uglybot', secret)(signed(' '.repeat(17000))))
        .status,
    ).toBe(413));
  it('bounds authentication attempts per instance', async () => {
    const handle = createBridgeHandler('uglybot', secret);
    for (let i = 0; i < 120; i++)
      await handle(new Request('https://bridge.example/v1/status/uglybot'));
    expect((await handle(signed())).status).toBe(429);
  });
  it.each([0, 501, 1.5])('rejects page size %s', (limit) =>
    expect(pageInput.safeParse({ limit }).success).toBe(false),
  );
  it.each([
    { sql: 'SELECT *' },
    { table: 'session' },
    { columns: ['password'] },
    { scope: { user_id: '123' } },
  ])('rejects arbitrary query shapes %j', (input) =>
    expect(pageInput.safeParse(input).success).toBe(false),
  );
  it('preserves microsecond cursor strings and correction ordering', () => {
    const input = pageInput.parse({
      order: 'updated',
      after: ['2026-01-01 01:02:03.123456+00', 'a'],
      since: '2026-01-01T00:00:00Z',
      limit: 1,
    });
    const p = effectivePage('duels', input);
    expect(p.spec.keys).toEqual(['updated_at', 'id']);
    expect(input.after?.[0]).toContain('123456');
    expect(p.since?.column).toBe('updated_at');
  });
  it('keeps reconciliation on the canonical key without timestamp ordering', () =>
    expect(
      effectivePage('duels', pageInput.parse({ order: 'key' })).spec.keys,
    ).toEqual(['id']));
  it('validates cursor arity and supported scopes', () => {
    expect(() =>
      effectivePage('duels', pageInput.parse({ after: ['a', 'b'] })),
    ).toThrow('INVALID_CURSOR');
    expect(() =>
      effectivePage('duels', pageInput.parse({ scope: { verified: true } })),
    ).toThrow('INVALID_SCOPE');
  });
  it('uses only named parameterized lookup definitions', () => {
    for (const q of Object.values(sourceQueries)) {
      expect(q.sql).toMatch(/^SELECT /);
      expect(q.sql).not.toContain('SELECT *');
      expect(q.sql).toContain('$1');
    }
    expect(
      sourceQueries.bountyParents.input.safeParse([Array(501).fill('1')])
        .success,
    ).toBe(false);
  });
  it('treats missing online rewards independently from valid runs', () => {
    const base = {
      integration: 'gauntlet' as const,
      configured: true,
      status: 'connected',
      transport: 'bridge' as const,
      reachable: true,
      authenticated: true,
      tables: [
        {
          table: 'gauntlet_runs',
          present: true,
          expectedColumns: [],
          columns: [],
          missingRequired: [],
          missingOptional: [],
          estimatedRows: '1',
        },
        {
          table: 'gauntlet_online_reward_events',
          present: false,
          expectedColumns: ['event_id'],
          columns: [],
          missingRequired: ['event_id'],
          missingOptional: [],
          estimatedRows: null,
        },
      ],
    };
    expect(sourceSchema(base)).toEqual({
      compatible: true,
      partial: true,
      unavailable: ['gauntlet_online_reward_events'],
    });
    base.tables[0].missingRequired = ['id'];
    expect(sourceSchema(base).compatible).toBe(false);
  });
  it('does not certify write privileges or unverifiable roles', () => {
    expect(safeSourceRole(undefined)).toBe(false);
    expect(
      safeSourceRole({
        read_only: 'on',
        superuser: false,
        can_write: true,
        unsafe: false,
      }),
    ).toBe(false);
  });
});
describe('HTTPS source client', () => {
  function configure() {
    vi.stubEnv('UGLYBOT_BRIDGE_URL', 'https://bridge.example');
    vi.stubEnv('UGLYBOT_BRIDGE_SECRET', secret);
  }
  it('fails closed for a half-configured bridge', async () => {
    vi.stubEnv('UGLYBOT_BRIDGE_URL', 'https://bridge.example');
    vi.stubEnv('UGLYBOT_BRIDGE_SECRET', '');
    expect(bridgeConfigured('uglybot')).toBe(true);
    expect(() => bridgeConfig('uglybot')).toThrow();
    expect((await bridgeRequest('uglybot', '/v1/status/uglybot')).ok).toBe(
      false,
    );
  });
  it.each([
    'http://bridge.example',
    'https://user:password@bridge.example',
    'https://bridge.example/path',
    'https://bridge.example?key=secret',
  ])('rejects unsafe origin %s', (url) => {
    configure();
    vi.stubEnv('UGLYBOT_BRIDGE_URL', url);
    expect(() => bridgeConfig('uglybot')).toThrow();
  });
  it('signs HTTPS requests and disables redirects', async () => {
    configure();
    const mock = vi.fn(
      async (input: URL | RequestInfo, options?: RequestInit) => {
        expect(String(input)).toBe(
          'https://bridge.example/v1/feeds/duels/page',
        );
        expect(options?.redirect).toBe('error');
        expect(
          new BridgeAuthenticator(secret).verify(
            'POST',
            '/v1/feeds/duels/page',
            String(options?.body),
            new Headers(options?.headers),
          ),
        ).toBe(true);
        return Response.json({ ok: true, data: [] });
      },
    );
    expect(
      await bridgeRequest(
        'uglybot',
        '/v1/feeds/duels/page',
        { limit: 1 },
        mock as typeof fetch,
      ),
    ).toEqual({ ok: true, data: [] });
  });
  it('redacts source failures and secrets', async () => {
    configure();
    const result = await bridgeRequest(
      'uglybot',
      '/v1/status/uglybot',
      undefined,
      async () => {
        throw new Error('secret postgres://password@private');
      },
    );
    expect(JSON.stringify(result)).not.toMatch(/password|postgres|secret/);
  });
  it('preserves source schema failure classification', async () => {
    configure();
    expect(
      await bridgeRequest(
        'uglybot',
        '/v1/feeds/onlineRewards/page',
        {},
        async () => new Response('private details', { status: 422 }),
      ),
    ).toEqual({ ok: false, reason: 'schema_mismatch' });
  });
  it('aborts timed out requests', async () => {
    configure();
    vi.useFakeTimers();
    const controller = new AbortController();
    vi.spyOn(AbortSignal, 'timeout').mockImplementation((milliseconds) => {
      expect(milliseconds).toBe(10_000);
      setTimeout(() => controller.abort(), milliseconds);
      return controller.signal;
    });
    const pending = bridgeRequest(
      'uglybot',
      '/v1/status/uglybot',
      undefined,
      async (_input, options) => {
        expect(options?.signal).toBeInstanceOf(AbortSignal);
        return new Promise<Response>((_resolve, reject) => {
          options!.signal!.addEventListener('abort', () =>
            reject(new DOMException('timed out', 'TimeoutError')),
          );
        });
      },
    );
    await vi.advanceTimersByTimeAsync(10_000);
    expect(controller.signal.aborted).toBe(true);
    expect(await pending).toEqual({ ok: false, reason: 'unavailable' });
  });
  it('rejects oversized or malformed responses', async () => {
    configure();
    expect(
      (
        await bridgeRequest(
          'uglybot',
          '/v1/status/uglybot',
          undefined,
          async () => Response.json({ ok: true, data: 'x'.repeat(2_000_001) }),
        )
      ).ok,
    ).toBe(false);
    expect(
      (
        await bridgeRequest(
          'uglybot',
          '/v1/status/uglybot',
          undefined,
          async () => Response.json({ password: 'hidden' }),
        )
      ).ok,
    ).toBe(false);
  });
});
