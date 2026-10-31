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
