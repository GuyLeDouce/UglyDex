import 'server-only';
import { createServer } from 'node:http';
import { z } from 'zod';
import { BridgeAuthenticator } from './bridge-auth';
import { bridgeGroups, type BridgeGroup } from './bridge-config';
import { integrationEnv, tables, type Integration } from './registry';
import { pageInput, effectivePage, type SourceFeed } from './bridge-protocol';
import { inspectIntegrations } from './inspect';
import { sourcePermissions, safeSourceRole } from './permissions';
import { readDirectPage, tableColumns } from './table';
import { sourceStats } from './source-stats';
import { sourceQueries, readSourceQuery, type SourceQuery } from './queries';
const json = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
    },
  });
export async function dispatchBridge(
  group: BridgeGroup,
  path: string,
  method: string,
  input: unknown,
) {
  const match = /^\/v1\/(status|permissions|lookups)\/([a-zA-Z]+)$/.exec(path),
    page = /^\/v1\/feeds\/([a-zA-Z]+)\/(page|columns|stats)$/.exec(path);
  let integration: Integration,
    feed: SourceFeed | undefined,
    query: SourceQuery | undefined;
  if (match?.[1] === 'lookups' && Object.hasOwn(sourceQueries, match[2])) {
    query = match[2] as SourceQuery;
    integration = sourceQueries[query].integration;
  } else if (match && Object.hasOwn(integrationEnv, match[2]))
    integration = match[2] as Integration;
  else if (page && Object.hasOwn(tables, page[1])) {
    feed = page[1] as SourceFeed;
    integration = tables[feed].integration;
  } else return json(404, { ok: false, code: 'UNSUPPORTED_FEED' });
  if (!(bridgeGroups[group] as readonly string[]).includes(integration))
    return json(404, { ok: false, code: 'UNSUPPORTED_FEED' });
  if (method !== (query || page?.[2] === 'page' ? 'POST' : 'GET'))
    return json(405, { ok: false, code: 'METHOD_NOT_ALLOWED' });
  if (match?.[1] === 'status')
    return json(200, {
      ok: true,
      data: (await inspectIntegrations(true, [integration]))[0],
    });
  const permissions = await sourcePermissions(integration, true);
  if (match?.[1] === 'permissions')
    return json(
      permissions.ok ? 200 : 503,
      permissions.ok ? permissions : { ok: false, code: 'SOURCE_UNAVAILABLE' },
    );
  if (!permissions.ok || !safeSourceRole(permissions.data[0]))
    return json(503, { ok: false, code: 'SOURCE_PRIVILEGES_UNVERIFIED' });
  if (query) {
    const args = z
      .object({ args: z.array(z.unknown()).max(2) })
      .strict()
      .parse(input).args;
    sourceQueries[query].input.parse(args);
    const result = await readSourceQuery(query, args, true);
    return json(
      result.ok ? 200 : 503,
      result.ok ? result : { ok: false, code: 'SOURCE_UNAVAILABLE' },
    );
  }
  const spec = tables[feed!],
    columns = await tableColumns(spec, true);
  if (!columns.ok) return json(503, { ok: false, code: 'SOURCE_UNAVAILABLE' });
  if (spec.required.some((c) => !columns.data.some((r) => r.column_name === c)))
    return json(422, {
      ok: false,
      code:
        feed === 'onlineRewards' && !columns.data.length
          ? 'FEED_UNAVAILABLE'
          : 'SCHEMA_MISMATCH',
    });
  if (page?.[2] === 'columns')
    return json(200, {
      ok: true,
      data: columns.data.filter((r) =>
        [...spec.required, ...spec.optional].includes(r.column_name),
      ),
    });
  const options = page?.[2] === 'page' ? pageInput.parse(input) : null;
  const effective = options ? effectivePage(feed!, options) : null;
  const result =
    options && effective
      ? await readDirectPage(
          effective.spec,
          options.after,
          effective.filters,
          options.limit,
          effective.since,
        )
      : await sourceStats(feed!, true);
  return json(
    result.ok ? 200 : result.reason === 'schema_mismatch' ? 422 : 503,
    result.ok ? result : { ok: false, code: 'SOURCE_UNAVAILABLE' },
  );
}
export function createBridgeHandler(
  group: BridgeGroup,
  secret: string,
  dispatch = dispatchBridge,
  now = () => Date.now(),
) {
  const auth = new BridgeAuthenticator(secret);
  let window = 0,
    requests = 0,
    running = 0;
  return async (request: Request) => {
    const path = new URL(request.url).pathname;
    if (request.method === 'GET' && path === '/healthz')
      return json(200, { ok: true });
    const minute = Math.floor(now() / 60_000);
    if (window !== minute) {
      window = minute;
      requests = 0;
    }
    if (++requests > 120 || running >= 4)
      return json(429, { ok: false, code: 'RATE_LIMITED' });
    if (
      new URL(request.url).search ||
      path.length > 120 ||
      !['GET', 'POST'].includes(request.method)
    )
      return json(400, { ok: false, code: 'INVALID_REQUEST' });
    let body = '';
    try {
      body = await request.text();
      if (Buffer.byteLength(body) > 16_384)
        return json(413, { ok: false, code: 'REQUEST_TOO_LARGE' });
      if (!auth.verify(request.method, path, body, request.headers, now()))
        return json(401, { ok: false, code: 'UNAUTHORIZED' });
      const input = body ? JSON.parse(body) : undefined;
      running++;
      try {
        return await dispatch(group, path, request.method, input);
      } finally {
        running--;
      }
    } catch (error) {
      return error instanceof z.ZodError || error instanceof SyntaxError
        ? json(400, { ok: false, code: 'INVALID_REQUEST' })
        : json(503, { ok: false, code: 'SOURCE_UNAVAILABLE' });
    }
  };
}
export function sourceBridgeServer(group: BridgeGroup, secret: string) {
  const handle = createBridgeHandler(group, secret);
  const server = createServer(async (req, res) => {
    const reply = (status: number, body: string) => {
      res.writeHead(status, {
        'content-type': 'application/json',
        'cache-control': 'no-store',
      });
      res.end(body);
    };
    try {
      let size = 0;
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 16_384) {
          reply(413, '{"ok":false,"code":"REQUEST_TOO_LARGE"}');
          return;
        }
        chunks.push(chunk);
      }
      if (
        req.url !== '/healthz' &&
        req.headers['x-forwarded-proto'] !== 'https'
      ) {
        reply(400, '{"ok":false,"code":"HTTPS_REQUIRED"}');
        return;
      }
      const headers = new Headers();
      for (const [name, value] of Object.entries(req.headers))
        if (typeof value === 'string') headers.set(name, value);
      const method = req.method ?? 'GET';
      const response = await handle(
        new Request('https://bridge.invalid' + (req.url ?? '/'), {
          method,
          headers,
          ...(method === 'POST'
            ? { body: Buffer.concat(chunks).toString('utf8') }
            : {}),
        }),
      );
      const body = await response.text();
      if (Buffer.byteLength(body) > 2_000_000) {
        reply(503, '{"ok":false,"code":"SOURCE_RESPONSE_TOO_LARGE"}');
        return;
      }
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(body);
    } catch {
      if (!res.headersSent)
        reply(503, '{"ok":false,"code":"SOURCE_UNAVAILABLE"}');
      else res.destroy();
    }
  });
  server.requestTimeout = 10_000;
  server.headersTimeout = 10_000;
  server.setTimeout(12_000, (socket) => socket.destroy());
  server.maxConnections = 20;
  return server;
}
