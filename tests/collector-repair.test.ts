import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  actor: vi.fn(),
  origin: vi.fn(),
  limit: vi.fn(),
  env: vi.fn(),
  binding: vi.fn(),
  backfill: vi.fn(),
  audit: vi.fn(),
}));
vi.mock('../src/server/admin', () => ({ adminActor: mocks.actor }));
vi.mock('../src/server/auth', () => ({
  requireOrigin: mocks.origin,
  rateLimit: mocks.limit,
}));
vi.mock('../src/domain/deployment', () => ({ appEnvironment: mocks.env }));
vi.mock('../src/server/deployment', () => ({
  assertDeploymentBinding: mocks.binding,
}));
vi.mock('../src/server/collector-discovery', () => ({
  backfillHolders: mocks.backfill,
}));
vi.mock('../src/server/db', () => ({
  db: () => ({ operationalAudit: { create: mocks.audit } }),
}));
import { POST } from '../src/app/api/admin/collector-discovery/route';
const request = (body: object) =>
  new Request('https://example.com/api/admin/collector-discovery', {
    method: 'POST',
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.actor.mockResolvedValue('collector:admin');
  mocks.env.mockReturnValue('staging');
  mocks.backfill.mockResolvedValue({
    complete: false,
    scanned: 50,
    created: 4,
    existing: 46,
    conflicts: 0,
    next: '0x' + 'a'.repeat(40),
  });
});
describe('staging collector repair boundary', () => {
  it('rejects unauthenticated access before reading holders', async () => {
    mocks.actor.mockResolvedValue(null);
    expect((await POST(request({}))).status).toBe(403);
    expect(mocks.backfill).not.toHaveBeenCalled();
  });
  it('rejects cross-origin requests', async () => {
    mocks.origin.mockImplementation(() => {
      throw Error('ORIGIN_REJECTED');
    });
    expect((await POST(request({}))).status).toBe(400);
    expect(mocks.backfill).not.toHaveBeenCalled();
  });
  it('refuses production even for an admin', async () => {
    mocks.env.mockReturnValue('production');
    expect(
      (
        await POST(
          request({ apply: true, confirmation: 'POPULATE_STAGING_HOLDERS' }),
        )
      ).status,
    ).toBe(403);
    expect(mocks.backfill).not.toHaveBeenCalled();
  });
  it('refuses a mismatched registered database', async () => {
    mocks.binding.mockRejectedValue(Error('DEPLOYMENT_IDENTITY_MISMATCH'));
    expect((await POST(request({}))).status).toBe(400);
    expect(mocks.backfill).not.toHaveBeenCalled();
  });
  it('defaults to bounded dry run without mutation audit', async () => {
    expect((await POST(request({}))).status).toBe(200);
    expect(mocks.backfill).toHaveBeenCalledWith({
      dryRun: true,
      after: '',
      limit: 50,
    });
    expect(mocks.audit).not.toHaveBeenCalled();
  });
  it('requires explicit confirmation to apply', async () => {
    expect((await POST(request({ apply: true }))).status).toBe(400);
    expect(mocks.backfill).not.toHaveBeenCalled();
  });
  it('audits confirmed apply and preserves resume cursor', async () => {
    const after = '0x' + 'b'.repeat(40);
    expect(
      (
        await POST(
          request({
            apply: true,
            after,
            confirmation: 'POPULATE_STAGING_HOLDERS',
          }),
        )
      ).status,
    ).toBe(200);
    expect(mocks.audit).toHaveBeenCalledOnce();
    expect(mocks.backfill).toHaveBeenCalledWith({
      dryRun: false,
      after,
      limit: 50,
    });
  });
  it('rejects arbitrary cursors and unbounded batch input', async () => {
    expect((await POST(request({ after: 'invalid' }))).status).toBe(400);
    expect((await POST(request({ limit: 999999 }))).status).toBe(400);
    expect(mocks.backfill).not.toHaveBeenCalled();
  });
});
