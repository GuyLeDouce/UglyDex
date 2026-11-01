import { beforeEach, expect, it, vi } from 'vitest';
const transaction = vi.hoisted(() => vi.fn());
vi.mock('@/server/db', () => ({ db: () => ({ $transaction: transaction }) }));
vi.mock('@/sync/provenance', () => ({ markWalletDirty: vi.fn() }));
vi.mock('@/server/log', () => ({ log: vi.fn() }));
import { confirmCollectorMerge } from '../src/server/collector-merge';
import { authError } from '../src/server/http';
beforeEach(() => {
  transaction.mockReset();
});
it('retries rolled-back serialization conflicts and returns the successful merge', async () => {
  transaction
    .mockRejectedValueOnce({ code: 'P2034' })
    .mockResolvedValue({ collectorId: 'survivor' });
  await expect(confirmCollectorMerge('request', 'survivor')).resolves.toEqual({
    collectorId: 'survivor',
  });
  expect(transaction).toHaveBeenCalledTimes(2);
});
it('does not retry consent, expiry or non-conflict failures', async () => {
  for (const message of [
    'MERGE_REQUEST_EXPIRED',
    'USERNAME_REQUIRED',
    'MERGE_CHARM_IDENTITY_CONFLICT',
    'other',
  ]) {
    transaction.mockReset().mockRejectedValue(new Error(message));
    await expect(confirmCollectorMerge('request', 'survivor')).rejects.toThrow(
      message,
    );
    expect(transaction).toHaveBeenCalledTimes(1);
  }
});
it('bounds conflict retries and exposes a temporary busy response', async () => {
  transaction.mockRejectedValue({ cause: { originalCode: '40001' } });
  await expect(confirmCollectorMerge('request', 'survivor')).rejects.toThrow(
    'MERGE_BUSY',
  );
  expect(transaction).toHaveBeenCalledTimes(3);
  const response = authError(new Error('MERGE_BUSY'));
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ error: 'MERGE_BUSY' });
});
