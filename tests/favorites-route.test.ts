import { beforeEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({
  session: vi.fn(),
  origin: vi.fn(),
  rate: vi.fn(),
  save: vi.fn(),
}));
vi.mock('../src/server/auth', () => ({
  currentSession: m.session,
  requireOrigin: m.origin,
  rateLimit: m.rate,
}));
vi.mock('../src/server/favorites', () => ({ setFavorite: m.save }));
import { POST } from '../src/app/api/settings/favorites/route';
const request = () =>
  new Request('https://example.com/api/settings/favorites', {
    method: 'POST',
    body: JSON.stringify({ tokenId: 1, favorite: true }),
  });
beforeEach(() => {
  vi.resetAllMocks();
  m.session.mockResolvedValue({ collectorId: 'owner' });
  m.save.mockResolvedValue({ favorites: [1] });
});
it('uses only the authenticated collector and returns the saved selection', async () => {
  const response = await POST(request());
  expect(response.status).toBe(200);
  expect(m.save).toHaveBeenCalledWith('owner', { tokenId: 1, favorite: true });
  expect(await response.json()).toEqual({ favorites: [1] });
  expect(response.headers.get('cache-control')).toBe('no-store');
});
it('requires authentication', async () => {
  m.session.mockResolvedValue(null);
  expect((await POST(request())).status).toBe(401);
  expect(m.save).not.toHaveBeenCalled();
});
it('requires a valid origin', async () => {
  m.origin.mockImplementation(() => {
    throw Error();
  });
  expect((await POST(request())).status).toBe(400);
  expect(m.save).not.toHaveBeenCalled();
});
it('enforces rate limiting', async () => {
  m.rate.mockRejectedValue(Error('RATE_LIMITED'));
  expect((await POST(request())).status).toBe(400);
  expect(m.save).not.toHaveBeenCalled();
});
it('explains the six favorite limit', async () => {
  m.save.mockRejectedValue(Error('FAVORITE_LIMIT'));
  expect((await (await POST(request())).json()).error).toContain('six');
});
it('explains ownership rejection', async () => {
  m.save.mockRejectedValue(Error('FAVORITE_NOT_OWNED'));
  expect((await (await POST(request())).json()).error).toContain(
    'currently own',
  );
});
