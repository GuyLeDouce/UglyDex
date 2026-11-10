import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  source: vi.fn(),
  connect: vi.fn(),
  validate: vi.fn(),
}));
vi.mock('../src/integrations/validate', () => ({
  validateIntegrations: mocks.validate,
}));
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
import { activityFeedReadiness } from '../src/integrations/availability';
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
it('revalidates failed sources on the next worker poll and continues healthy feeds', async () => {
  mocks.source.mockImplementation(
    async ({ where }: { where: { id: string } }) => ({
      state: where.id === 'onlineRewards' ? 'ERROR' : 'PARTIAL',
      warning: null,
      schemaValid: where.id !== 'onlineRewards',
      backfillFinishedAt: new Date(),
    }),
  );
  await activityCycle({ workerMode: 'LIVE' });
  expect(mocks.validate).toHaveBeenCalledTimes(1);
  expect(mocks.connect).toHaveBeenCalledTimes(1);
  mocks.source.mockResolvedValue({
    state: 'PARTIAL',
    warning: null,
    schemaValid: true,
    backfillFinishedAt: new Date(),
  });
  await activityCycle({ workerMode: 'LIVE' });
  expect(mocks.validate).toHaveBeenCalledTimes(2);
  expect(mocks.connect).toHaveBeenCalledTimes(3);
});
it('admits each feed only after schema, permissions and live backfill checks', () => {
  const ready = {
    state: 'PARTIAL',
    warning: null,
    schemaValid: true,
    backfillFinishedAt: new Date(),
  };
  expect(activityFeedReadiness(ready, 'LIVE')).toBe('READY');
  expect(
    activityFeedReadiness({ ...ready, backfillFinishedAt: null }, 'LIVE'),
  ).toBe('WAITING_BACKFILL');
  expect(
    activityFeedReadiness({ ...ready, backfillFinishedAt: null }, 'HISTORICAL'),
  ).toBe('READY');
  for (const patch of [
    { schemaValid: false },
    { state: 'ERROR' },
    { warning: 'ROLE_HAS_WRITE_PRIVILEGES' },
    { warning: 'PERMISSIONS_UNAVAILABLE' },
  ])
    expect(activityFeedReadiness({ ...ready, ...patch }, 'LIVE')).toBe(
      'WAITING_SOURCE_VALIDATION',
    );
});
