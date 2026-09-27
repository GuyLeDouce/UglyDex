import 'server-only';
import { bridgeConfig } from './bridge-config';
import { signBridge } from './bridge-auth';
import type { Integration } from './registry';
import type { IntegrationResult } from './read-only';
export async function bridgeRequest<T>(
  integration: Integration,
  path: string,
  input?: unknown,
  fetcher: typeof fetch = fetch,
): Promise<IntegrationResult<T>> {
  try {
    const { url, secret } = bridgeConfig(integration);
    const body = input === undefined ? '' : JSON.stringify(input),
      method = input === undefined ? 'GET' : 'POST';
    const response = await fetcher(new URL(path, url), {
      method,
      headers: {
        ...signBridge(secret, method, path, body),
        'content-type': 'application/json',
      },
      ...(body ? { body } : {}),
      redirect: 'error',
      signal: AbortSignal.timeout(10_000),
      cache: 'no-store',
    });
    if (!response.ok)
      return {
        ok: false,
        reason: response.status === 422 ? 'schema_mismatch' : 'unavailable',
      };
    if (!response.headers.get('content-type')?.startsWith('application/json'))
      return { ok: false, reason: 'invalid_data' };
    const reader = response.body?.getReader();
    if (!reader) return { ok: false, reason: 'invalid_data' };
    let size = 0;
    const chunks: Uint8Array[] = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 2_000_000) {
        await reader.cancel();
        return { ok: false, reason: 'invalid_data' };
      }
      chunks.push(value);
    }
    const result = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (result?.ok !== true || !Object.hasOwn(result, 'data'))
      return { ok: false, reason: 'invalid_data' };
    return { ok: true, data: result.data as T };
  } catch {
    // Never propagate URLs, signatures, bodies, upstream error messages or keys.
    return { ok: false, reason: 'unavailable' };
  }
}
