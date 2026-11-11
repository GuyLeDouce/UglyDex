import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  identity: vi.fn(),
  env: vi.fn(),
}));
vi.mock('@/server/auth', () => ({
  currentSession: mocks.session,
  authHash: (s: string) => 'hash:' + s,
}));
vi.mock('@/server/db', () => ({
  db: () => ({ externalIdentity: { findFirst: mocks.identity } }),
}));
vi.mock('@/server/env', () => ({ readEnv: mocks.env }));
import { adminActor } from '@/server/admin';
import { configuredAdminOwner } from '@/domain/admin-profiles';
const owner = '333333333333333333';
beforeEach(() => {
  vi.clearAllMocks();
  mocks.env.mockReturnValue({ ADMIN_DISCORD_IDS: owner });
  mocks.identity.mockResolvedValue({ id: 'identity' });
  mocks.session.mockResolvedValue({
    collectorId: 'collector',
    authMethod: 'DISCORD_OAUTH',
    credentialFingerprint: 'hash:DISCORD_OAUTH:' + owner,
  });
});
describe('owner-only OAuth admin', () => {
  it('rejects anonymous, wallet, legacy and other Discord sessions even on the owner profile', async () => {
    for (const session of [
      null,
      { authMethod: 'WALLET_SIWE' },
      { authMethod: null },
      {
        authMethod: 'DISCORD_OAUTH',
        credentialFingerprint: 'hash:DISCORD_OAUTH:444444444444444444',
      },
    ]) {
      mocks.session.mockResolvedValue(session);
      expect(await adminActor()).toBeNull();
    }
    expect(mocks.identity).not.toHaveBeenCalled();
  });
  it('requires the owner OAuth session and a current authenticated identity', async () => {
    expect(await adminActor()).toBe('collector:collector');
    mocks.identity.mockResolvedValue(null);
    expect(await adminActor()).toBeNull();
  });
  it('fails closed for missing or ambiguous config, including development', async () => {
    expect(configuredAdminOwner(undefined, '')).toBeNull();
    expect(
      configuredAdminOwner(undefined, owner + ',444444444444444444'),
    ).toBeNull();
    expect(configuredAdminOwner(owner, '444444444444444444')).toBe(owner);
    mocks.env.mockReturnValue({ ADMIN_DISCORD_IDS: '' });
    expect(await adminActor()).toBeNull();
  });
});
