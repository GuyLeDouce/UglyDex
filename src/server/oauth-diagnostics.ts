// Never log provider descriptions, response bodies, credentials or raw errors.
export function safeOAuthFailure(error: unknown) {
  const known = [
    'INVALID_CHALLENGE',
    'RATE_LIMITED',
    'OAUTH_EXCHANGE_FAILED',
    'OAUTH_IDENTITY_FAILED',
    'AUTH_UNCONFIGURED',
    'DEPLOYMENT_IDENTITY_MISMATCH',
  ];
  if (error instanceof Error && known.includes(error.message))
    return error.message;
  if (error instanceof Error && error.name === 'TimeoutError')
    return 'UPSTREAM_TIMEOUT';
  if (error instanceof Error && error.name === 'ZodError')
    return 'INVALID_RESPONSE';
  if (error && typeof error === 'object' && 'code' in error) {
    const code = error.code;
    if (typeof code === 'string' && /^P\d{4}$/.test(code)) return code;
  }
  return 'UNEXPECTED_ERROR';
}

export async function oauthRejection(response: Response) {
  try {
    const body: unknown = await response.json();
    const code =
      body && typeof body === 'object' && 'error' in body
        ? body.error
        : undefined;
    return typeof code === 'string' &&
      [
        'invalid_client',
        'invalid_grant',
        'invalid_request',
        'unauthorized_client',
        'unsupported_grant_type',
        'invalid_scope',
      ].includes(code)
      ? code
      : 'unclassified';
  } catch {
    return 'unclassified';
  }
}

// Do not retry a one-use OAuth code or expose provider response bodies.
export function discordRateLimitResponse(
  response: Response,
  publicBaseUrl: string,
) {
  const raw = response.headers.get('retry-after');
  const seconds =
    raw && /^\d+(?:\.\d+)?$/.test(raw) ? Math.ceil(Number(raw)) : null;
  const retryAfter =
    seconds !== null &&
    Number.isSafeInteger(seconds) &&
    seconds > 0 &&
    seconds <= 86400
      ? seconds
      : null;
  console.error(
    JSON.stringify({
      event: 'auth.discord_rate_limited',
      retryAfterSeconds: retryAfter,
    }),
  );
  const url = new URL('/connect', publicBaseUrl);
  url.searchParams.set('error', 'DISCORD_RATE_LIMITED');
  if (retryAfter !== null)
    url.searchParams.set('retryAfter', String(retryAfter));
  return new Response(null, {
    status: 303,
    headers: { Location: url.href, 'Cache-Control': 'no-store' },
  });
}
