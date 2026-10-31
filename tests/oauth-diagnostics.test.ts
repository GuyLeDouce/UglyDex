import { expect, it } from 'vitest';
import {
  oauthRejection,
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
