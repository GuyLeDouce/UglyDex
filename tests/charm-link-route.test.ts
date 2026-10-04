import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  currentSession: vi.fn(),
  rateLimit: vi.fn(),
  requireOrigin: vi.fn(),
  verifyAndLinkDripMember: vi.fn(),
}));

vi.mock('@/server/auth', () => ({
  currentSession: mocks.currentSession,
  rateLimit: mocks.rateLimit,
  requireOrigin: mocks.requireOrigin,
}));
vi.mock('@/server/charm-link', () => ({
  verifyAndLinkDripMember: mocks.verifyAndLinkDripMember,
}));

import { POST } from '@/app/api/charm/link/route';

const memberId = 'c'.repeat(24);

function request(body: unknown, origin = 'https://uglydex.example') {
  return new Request('https://uglydex.example/api/charm/link', {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.currentSession.mockResolvedValue({ collectorId: 'collector-fixture' });
  mocks.rateLimit.mockResolvedValue(undefined);
  mocks.requireOrigin.mockImplementation((req: Request) => {
    if (req.headers.get('origin') !== 'https://uglydex.example')
      throw new Error('ORIGIN_REJECTED');
  });
  mocks.verifyAndLinkDripMember.mockResolvedValue({ balanceAvailable: true });
});

describe('POST /api/charm/link', () => {
  it('returns 401 before reading the submitted ID when unauthenticated', async () => {
    mocks.currentSession.mockResolvedValue(null);
    const response = await POST(request({ dripUserId: memberId }));
    expect(response.status).toBe(401);
    expect(mocks.verifyAndLinkDripMember).not.toHaveBeenCalled();
  });

  it('rejects a wrong Origin without linking', async () => {
    const response = await POST(
      request({ dripUserId: memberId }, 'https://attacker.example'),
    );
    expect(response.status).toBe(403);
    expect(mocks.verifyAndLinkDripMember).not.toHaveBeenCalled();
  });

  it('returns 400 for malformed IDs and accepts valid ID shape for verification', async () => {
    const malformed = await POST(request({ dripUserId: 'username' }));
    expect(malformed.status).toBe(400);
    expect(mocks.verifyAndLinkDripMember).not.toHaveBeenCalled();

    const valid = await POST(request({ dripUserId: memberId }));
    expect(valid.status).toBe(200);
    expect(mocks.verifyAndLinkDripMember).toHaveBeenCalledWith(
      'collector-fixture',
      memberId,
    );
  });

  it('enforces the per-Collector link rate limit', async () => {
    mocks.rateLimit.mockRejectedValue(new Error('RATE_LIMITED'));
    const response = await POST(request({ dripUserId: memberId }));
    expect(response.status).toBe(429);
    expect(mocks.rateLimit).toHaveBeenCalledWith(
      'charm-id-link',
      'collector-fixture',
      3,
    );
    expect(mocks.verifyAndLinkDripMember).not.toHaveBeenCalled();
  });

  it('returns only safe link status and no IDs, balance, wallet, or Discord data', async () => {
    const response = await POST(request({ dripUserId: memberId }));
    const body = await response.text();
    expect(response.status).toBe(200);
    expect(JSON.parse(body)).toEqual({ linked: true, balanceAvailable: true });
    expect(body).not.toMatch(
      /dripMemberId|realmMemberId|balances|balance\"\s*:|wallet|discord|c{24}/i,
    );
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('keeps identity verification failures generic', async () => {
    mocks.verifyAndLinkDripMember.mockRejectedValue(
      new Error('DRIP_MEMBER_IDENTITY_UNVERIFIED'),
    );
    const response = await POST(request({ dripUserId: memberId }));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: 'We could not verify that DRIP account belongs to you.',
    });
  });
});
