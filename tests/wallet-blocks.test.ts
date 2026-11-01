import { beforeEach, expect, it, vi } from 'vitest';
import { walletBlockInput } from '../src/domain/wallet-blocks';
const mocks = vi.hoisted(() => ({
  admin: vi.fn(),
  origin: vi.fn(),
  limit: vi.fn(),
  change: vi.fn(),
}));
vi.mock('../src/server/admin', () => ({ adminActor: mocks.admin }));
vi.mock('../src/server/auth', () => ({
  requireOrigin: mocks.origin,
  rateLimit: mocks.limit,
}));
vi.mock('../src/server/wallet-blocks', () => ({
  changeWalletBlock: mocks.change,
}));
import { POST } from '../src/app/api/admin/blockwallet/route';
const address = '0x' + 'AB'.repeat(20);
const request = () =>
  new Request('https://uglydex.test/api/admin/blockwallet', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'block',
      walletAddress: address,
      reason: 'Test',
    }),
  });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.admin.mockResolvedValue('admin:test');
  mocks.change.mockResolvedValue({ changed: true });
});
it('normalizes addresses and rejects invalid wallets and blank reasons', () => {
  expect(
    walletBlockInput.parse({
      action: 'block',
      walletAddress: ' ' + address + ' ',
      reason: ' Test ',
    }),
  ).toMatchObject({ walletAddress: address.toLowerCase(), reason: 'Test' });
  for (const walletAddress of ['0x123', 'not-an-address', address + '0'])
    expect(
      walletBlockInput.safeParse({
        action: 'block',
        walletAddress,
        reason: 'Test',
      }).success,
    ).toBe(false);
  expect(
    walletBlockInput.safeParse({
      action: 'block',
      walletAddress: address,
      reason: '  ',
    }).success,
  ).toBe(false);
});
it('denies non-admin access before mutation', async () => {
  mocks.admin.mockResolvedValue(null);
  expect((await POST(request())).status).toBe(404);
  expect(mocks.change).not.toHaveBeenCalled();
});
it('rejects cross-origin mutations', async () => {
  mocks.origin.mockImplementation(() => {
    throw new Error('ORIGIN_REJECTED');
  });
  expect((await POST(request())).status).toBe(403);
  expect(mocks.change).not.toHaveBeenCalled();
});
it('rate limits moderation requests', async () => {
  mocks.limit.mockRejectedValue(new Error('RATE_LIMITED'));
  expect((await POST(request())).status).toBe(429);
  expect(mocks.change).not.toHaveBeenCalled();
});
it('records the authenticated actor and prevents response caching', async () => {
  const result = await POST(request());
  expect(result.status).toBe(200);
  expect(result.headers.get('cache-control')).toBe('no-store');
  expect(mocks.change).toHaveBeenCalledWith(
    'admin:test',
    expect.objectContaining({ action: 'block' }),
  );
});
it('rejects stale unblock requests without leaking internal errors', async () => {
  mocks.change.mockRejectedValue(new Error('BLOCK_CHANGED'));
  expect((await POST(request())).status).toBe(409);
  mocks.change.mockRejectedValue(new Error('secret connection detail'));
  const result = await POST(request());
  expect(result.status).toBe(503);
  expect(await result.text()).not.toContain('secret');
});
