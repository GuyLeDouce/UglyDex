import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
export const bridgeSkewMs = 60_000;
export function bridgeSignature(
  secret: string,
  method: string,
  path: string,
  timestamp: string,
  nonce: string,
  body: string,
) {
  return createHmac('sha256', secret)
    .update(
      [
        'uglydex-bridge-v1',
        method,
        path,
        timestamp,
        nonce,
        createHash('sha256').update(body).digest('hex'),
      ].join('\n'),
    )
    .digest('hex');
}
export function signBridge(
  secret: string,
  method: string,
  path: string,
  body: string,
  now = Date.now(),
) {
  const timestamp = String(now),
    nonce = randomBytes(24).toString('hex');
  return {
    'x-bridge-timestamp': timestamp,
    'x-bridge-nonce': nonce,
    'x-bridge-signature': bridgeSignature(
      secret,
      method,
      path,
      timestamp,
      nonce,
      body,
    ),
  };
}
// One replica per bridge. Fail closed when capacity is exhausted; never evict a
// still-valid nonce to make room. Restart limitations are documented explicitly.
export class BridgeAuthenticator {
  private nonces = new Map<string, number>();
  constructor(private secret: string) {
    if (secret.length < 32) throw new Error('INVALID_BRIDGE_SECRET');
  }
  verify(
    method: string,
    path: string,
    body: string,
    headers: Headers,
    now = Date.now(),
  ) {
    const timestamp = headers.get('x-bridge-timestamp') ?? '',
      nonce = headers.get('x-bridge-nonce') ?? '',
      signature = headers.get('x-bridge-signature') ?? '';
    if (
      !/^\d{13}$/.test(timestamp) ||
      Math.abs(now - Number(timestamp)) > bridgeSkewMs ||
      !/^[a-f0-9]{48}$/.test(nonce) ||
      !/^[a-f0-9]{64}$/.test(signature)
    )
      return false;
    const expected = bridgeSignature(
      this.secret,
      method,
      path,
      timestamp,
      nonce,
      body,
    );
    if (
      !timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expected, 'hex'),
      )
    )
      return false;
    for (const [key, expires] of this.nonces)
      if (expires < now) this.nonces.delete(key);
    if (this.nonces.has(nonce) || this.nonces.size >= 4000) return false;
    this.nonces.set(nonce, Number(timestamp) + bridgeSkewMs);
    return true;
  }
}
