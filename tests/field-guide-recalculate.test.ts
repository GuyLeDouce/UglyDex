import { beforeEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({
  session: vi.fn(),
  origin: vi.fn(),
  rate: vi.fn(),
  binding: vi.fn(),
  env: vi.fn(),
  seed: vi.fn(),
  rebuild: vi.fn(),
}));
vi.mock('../src/server/auth', () => ({
  currentSession: m.session,
  requireOrigin: m.origin,
  rateLimit: m.rate,
}));
vi.mock('../src/server/deployment', () => ({
  assertDeploymentBinding: m.binding,
}));
vi.mock('../src/domain/deployment', () => ({ appEnvironment: m.env }));
vi.mock('../src/server/dex-engine', () => ({
  seedCollections: m.seed,
  rebuildCollection: m.rebuild,
}));
import { POST } from '../src/app/api/collection/recalculate/route';
const request = () =>
  new Request('https://example.com/api/collection/recalculate', {
    method: 'POST',
    body: JSON.stringify({ collectorId: 'someone-else' }),
  });
beforeEach(() => {
  vi.resetAllMocks();
  m.session.mockResolvedValue({ collectorId: 'signed-in-collector' });
  m.env.mockReturnValue('staging');
  m.rebuild.mockResolvedValue({ discovered: 315 });
});
it('recalculates only the authenticated collector, never a supplied ID', async () => {
  expect((await POST(request())).status).toBe(200);
  expect(m.rebuild).toHaveBeenCalledWith('signed-in-collector');
});
it('rejects unauthenticated requests', async () => {
  m.session.mockResolvedValue(null);
  expect((await POST(request())).status).toBe(401);
  expect(m.rebuild).not.toHaveBeenCalled();
});
it('rejects invalid origin', async () => {
  m.origin.mockImplementation(() => {
    throw Error();
  });
  expect((await POST(request())).status).toBe(400);
  expect(m.rebuild).not.toHaveBeenCalled();
});
it('refuses production recalculation', async () => {
  m.env.mockReturnValue('production');
  expect((await POST(request())).status).toBe(403);
  expect(m.seed).not.toHaveBeenCalled();
});
it('does not write when deployment binding fails', async () => {
  m.binding.mockRejectedValue(Error());
  expect((await POST(request())).status).toBe(400);
  expect(m.seed).not.toHaveBeenCalled();
});
it('respects request throttling', async () => {
  m.rate.mockRejectedValue(Error());
  expect((await POST(request())).status).toBe(400);
  expect(m.rebuild).not.toHaveBeenCalled();
});
