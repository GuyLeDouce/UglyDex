import { expect, it } from 'vitest';
import {
  oauthRejection,
  discordRateLimitResponse,
  safeOAuthFailure,
} from '../src/server/oauth-diagnostics';

it('logs only recognized OAuth failure categories', () => {
  expect(safeOAuthFailure(new Error('OAUTH_EXCHANGE_FAILED'))).toBe(
    'OAUTH_EXCHANGE_FAILED',
  );
  expect(
    safeOAuthFailure(
      Object.assign(new Error('private database query'), { code: 'P2002' }),
    ),
  ).toBe('P2002');
  expect(safeOAuthFailure(new Error('token=secret account=private'))).toBe(
    'UNEXPECTED_ERROR',
  );
  expect(safeOAuthFailure({ code: 'secret', message: 'secret' })).toBe(
    'UNEXPECTED_ERROR',
  );
});

it('discards provider descriptions and unrecognized provider errors', async () => {
  expect(
    await oauthRejection(
      Response.json({ error: 'invalid_client', error_description: 'secret' }),
    ),
  ).toBe('invalid_client');
  expect(
    await oauthRejection(
      Response.json({ error: 'secret', access_token: 'secret' }),
    ),
  ).toBe('unclassified');
  expect(await oauthRejection(new Response('private upstream html'))).toBe(
    'unclassified',
  );
});

it('redirects rate-limited OAuth to a fresh sign-in without leaking provider data', async () => {
  const response = discordRateLimitResponse(
    new Response('private provider body', {
      status: 429,
      headers: { 'retry-after': '2.5' },
    }),
    'https://ugly.test',
  );
  expect(response.status).toBe(303);
  expect(response.headers.get('location')).toBe(
    'https://ugly.test/connect?error=DISCORD_RATE_LIMITED&retryAfter=3',
  );
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(await response.text()).toBe('');
});
it('omits unknown or malformed retry timing instead of inventing a cooldown', () => {
  for (const value of ['', 'secret', '-1', 'Infinity', '999999999', '0']) {
    const response = discordRateLimitResponse(
      new Response(null, { status: 429, headers: { 'retry-after': value } }),
      'https://ugly.test',
    );
    expect(response.headers.get('location')).toBe(
      'https://ugly.test/connect?error=DISCORD_RATE_LIMITED',
    );
  }
});
