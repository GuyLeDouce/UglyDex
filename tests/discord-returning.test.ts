import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  identity: vi.fn(),
  createIdentity: vi.fn(),
  updateIdentity: vi.fn(),
  createSession: vi.fn(),
  updateCollector: vi.fn(),
  setCookie: vi.fn(),
}));
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined, set: mocks.setCookie }),
}));
vi.mock('@/server/env', () => ({
  readEnv: () => ({
    AUTH_SECRET: 'fixture-secret-'.repeat(4),
    NODE_ENV: 'test',
  }),
}));
vi.mock('@/server/collector-discovery', () => ({
  adoptDiscoveredWallet: vi.fn(),
}));
vi.mock('@/sync/provenance', () => ({ markWalletDirty: vi.fn() }));
vi.mock('@/server/db', () => {
  const tx = {
    $executeRaw: vi.fn(),
    externalIdentity: {
      findUnique: mocks.identity,
      create: mocks.createIdentity,
      update: mocks.updateIdentity,
    },
    collector: {
      updateMany: mocks.updateCollector,
      findUniqueOrThrow: async () => ({ slug: 'same-collector' }),
    },
    authSession: { create: mocks.createSession },
  };
  return {
    db: () => ({
      ...tx,
      $transaction: async (run: (t: typeof tx) => unknown) => run(tx),
    }),
  };
});
import { authenticateDiscord } from '@/server/auth';
beforeEach(() => {
  vi.clearAllMocks();
});
describe('returning Discord authentication', () => {
  it('uses the existing unified collector without changing consent', async () => {
    mocks.identity.mockResolvedValue({
      id: 'identity',
      collectorId: 'unified',
      authenticatedAt: new Date(),
    });
    await expect(
      authenticateDiscord('123456789012345678', 'user', null),
    ).resolves.toEqual({ slug: 'same-collector' });
    expect(mocks.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          collectorId: 'unified',
          authMethod: 'DISCORD_OAUTH',
        }),
      }),
    );
    expect(mocks.createIdentity).not.toHaveBeenCalled();
    expect(mocks.updateCollector).toHaveBeenCalledWith({
      where: { id: 'unified', claimedAt: null },
      data: { claimedAt: expect.any(Date) },
    });
  });
  it('does not create an account from Discord-first sign-in', async () => {
    mocks.identity.mockResolvedValue(null);
    await expect(
      authenticateDiscord('123456789012345678', 'user', null),
    ).rejects.toThrow('WALLET_REQUIRED');
    expect(mocks.createIdentity).not.toHaveBeenCalled();
    expect(mocks.createSession).not.toHaveBeenCalled();
  });
  it('does not treat imported Discord attribution as an authorized sign-in', async () => {
    mocks.identity.mockResolvedValue({
      id: 'identity',
      collectorId: 'imported',
      authenticatedAt: null,
    });
    await expect(
      authenticateDiscord('123456789012345678', 'user', null),
    ).rejects.toThrow('WALLET_REQUIRED');
    expect(mocks.createSession).not.toHaveBeenCalled();
  });
});
