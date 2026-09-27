import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ source: vi.fn(), connect: vi.fn() }));
vi.mock('pg', () => ({
  Pool: class {
    connect = mocks.connect;
  },
}));
vi.mock('../src/server/db', () => ({
  db: () => ({ integrationSource: { findUnique: mocks.source } }),
}));
vi.mock('../src/server/env', () => ({
  readEnv: () => ({ DATABASE_URL: 'postgresql://fixture/fixture' }),
}));
vi.mock('../src/sync/import-event', () => ({
  reattributePending: async () => {},
  importRecord: vi.fn(),
}));
vi.mock('../src/integrations/bridge-config', () => ({
  integrationConfigured: (name: string) => name === 'gauntlet',
}));
vi.mock('../src/server/log', () => ({ log: vi.fn() }));
import { activityCycle } from '../src/sync/activity';
beforeEach(() => {
  vi.resetAllMocks();
  mocks.connect.mockRejectedValue(new Error('FIXTURE_STOP_BEFORE_IMPORT'));
  mocks.source.mockImplementation(
    async ({ where }: { where: { id: string } }) =>
      where.id === 'onlineRewards'
        ? {
            state: 'UNAVAILABLE',
            warning: 'FEED_UNAVAILABLE',
            schemaValid: false,
          }
        : { state: 'PARTIAL', schemaValid: true },
  );
});
it('does not attempt known unavailable optional feed during live cycles', async () => {
  await activityCycle();
  expect(mocks.connect).toHaveBeenCalledTimes(1);
});
it('does not suppress unexpected failures as optional unavailability', async () => {
  mocks.source.mockResolvedValue({
    state: 'ERROR',
    warning: 'IMPORT_FAILED',
    schemaValid: false,
  });
  await activityCycle();
  expect(mocks.connect).toHaveBeenCalledTimes(2);
});
