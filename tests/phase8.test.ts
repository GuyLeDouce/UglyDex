import { describe, it, expect } from 'vitest';
import {
  appEnvironment,
  databaseFingerprint,
  operationalIntent,
  restoreTarget,
} from '../src/domain/deployment';
import { subsystemStatus } from '../src/domain/reliability';
import { requirePassingGate, type Check } from '../src/domain/operations';
import {
  applyEditionEvents,
  contractManifest,
  editionHoldingPeriods,
  zero,
} from '../src/domain/edition-history';
const source = 'postgresql://fixture:fixture@localhost/uglydex',
  target = 'postgresql://fixture:fixture@localhost/uglydex_restore_fixture';
describe('deployment and restore intent', () => {
  it('requires an explicit deployed environment', () =>
    expect(() => appEnvironment({ NODE_ENV: 'production' })).toThrow(
      'APP_ENV_REQUIRED',
    ));
  it('local development remains available', () =>
    expect(appEnvironment({})).toBe('development'));
  it('fingerprints exclude credentials', () =>
    expect(databaseFingerprint(source)).toBe(
      databaseFingerprint(source.replace('fixture:fixture', 'other:secret')),
    ));
  it('rejects URL host overrides', () =>
    expect(() => databaseFingerprint(source + '?host=elsewhere')).toThrow());
  it.each(['staging', 'production'])(
    'requires action and target intent for %s',
    (APP_ENV) => {
      expect(() =>
        operationalIntent('backfill', { APP_ENV, DATABASE_URL: source }),
      ).toThrow();
      expect(
        operationalIntent('backfill', {
          APP_ENV,
          DATABASE_URL: source,
          OPS_CONFIRM: APP_ENV + ':backfill',
          OPS_DATABASE_FINGERPRINT: databaseFingerprint(source),
        }),
      ).toBe(APP_ENV);
    },
  );
  it('action confirmation is not reusable for another operation', () =>
    expect(() =>
      operationalIntent('replay', {
        APP_ENV: 'production',
        DATABASE_URL: source,
        OPS_CONFIRM: 'production:backfill',
        OPS_DATABASE_FINGERPRINT: databaseFingerprint(source),
      }),
    ).toThrow());
  const env = {
    DATABASE_URL: source,
    RESTORE_TARGET_URL: target,
    RESTORE_DRILL_CONFIRM: 'RESTORE_INTO_EMPTY_DISPOSABLE_DATABASE',
  };
  it('accepts explicitly named disposable target', () =>
    expect(restoreTarget(env).pathname).toBe('/uglydex_restore_fixture'));
  it.each([
    { RESTORE_DRILL_CONFIRM: '' },
    { RESTORE_TARGET_URL: source },
    { RESTORE_TARGET_URL: target.replace('localhost', 'prod.internal') },
    {
      RESTORE_TARGET_URL: target.replace(
        'uglydex_restore_fixture',
        'production',
      ),
    },
    { DATABASE_URL: target },
    { PRODUCTION_DATABASE_FINGERPRINT: databaseFingerprint(target) },
  ])('rejects unsafe restore %j', (patch) =>
    expect(() => restoreTarget({ ...env, ...patch })).toThrow(),
  );
});
describe('operational status evidence', () => {
  it.each([
    [{ enabled: false }, 'DISABLED'],
    [{ enabled: true }, 'DEGRADED'],
    [{ enabled: true, observed: true }, 'HEALTHY'],
    [{ enabled: true, observed: true, ageMs: 90001 }, 'DEGRADED'],
    [{ enabled: true, failed: true }, 'FAILED'],
    [{ enabled: true, observed: true, lag: 65n }, 'DEGRADED'],
    [{ enabled: true, observed: true, lag: 64n }, 'HEALTHY'],
  ] as const)('derives deterministic status', (input, status) =>
    expect(subsystemStatus(input)).toBe(status),
  );
});
const a = '0x' + '1'.repeat(40),
  b = '0x' + '2'.repeat(40),
  time = new Date('2026-01-01T00:00:00Z');
const event = (fromAddress: string, toAddress: string, quantity = '1') => ({
  id: 'test',
  tokenId: '1',
  fromAddress,
  toAddress,
  quantity,
  eventAt: time,
});
describe('Edition quantity and mint semantics', () => {
  it('ERC721 mint transfer burn', () => {
    const rows = applyEditionEvents(
      'ERC721',
      [],
      [event(zero, a), event(a, b), event(b, zero)],
    );
    expect(rows.map((r) => r.quantity)).toEqual(['0', '0']);
    expect(rows[0].maximumQuantity).toBe('1');
  });
  it('self transfer preserves quantity', () =>
    expect(
      applyEditionEvents('ERC721', [], [event(zero, a), event(a, a)])[0]
        .quantity,
    ).toBe('1'));
  it('replaying identical source order produces identical projections', () => {
    const events = [event(zero, a), event(a, b)];
    expect(applyEditionEvents('ERC721', [], events)).toEqual(
      applyEditionEvents('ERC721', [], events),
    );
  });
  it('reorg replay restores prior holder', () =>
    expect(applyEditionEvents('ERC721', [], [event(zero, a)])[0].quantity).toBe(
      '1',
    ));
  it('ERC1155 partial transfer and burn preserves multiple balances', () => {
    const rows = applyEditionEvents(
      'ERC1155',
      [],
      [event(zero, a, '10'), event(a, b, '4'), event(b, zero, '2')],
    );
    expect(rows.map((r) => r.quantity)).toEqual(['6', '2']);
    expect(rows[0].maximumQuantity).toBe('10');
  });
  it('ERC1155 batch positions can repeatedly reference an ID', () =>
    expect(
      applyEditionEvents(
        'ERC1155',
        [],
        [event(zero, a, '3'), event(zero, a, '2')],
      )[0].quantity,
    ).toBe('5'));
  it('zero quantity does not create discovery', () =>
    expect(applyEditionEvents('ERC1155', [], [event(zero, a, '0')])).toEqual(
      [],
    ));
  it.each([
    ['ERC721', [event(zero, a, '2')]],
    ['ERC721', [event(zero, a), event(zero, b)]],
    ['ERC721', [event(a, b)]],
    ['ERC1155', [event(zero, a, '2'), event(a, b, '3')]],
    ['ERC1155', [event(zero, zero, '1')]],
  ])('halts invalid ownership instead of fabricating it', (standard, events) =>
    expect(() =>
      applyEditionEvents(
        standard as string,
        [],
        events as ReturnType<typeof event>[],
      ),
    ).toThrow(),
  );
  const manifest = {
    chainId: 1,
    address: a,
    standard: 'ERC1155',
    startBlock: '100',
    tokenIds: ['1', '2'],
    sourceReference: 'reviewed-test-only',
  };
  it('valid reviewed registry format', () =>
    expect(contractManifest.parse(manifest).standard).toBe('ERC1155'));
  it.each([
    { chainId: 2 },
    { address: zero },
    { tokenIds: ['1', '1'] },
    { startBlock: '0' },
    { tokenIds: ['-1'] },
    { standard: 'ERC20' },
    { image: 'https://evil.invalid' },
  ])('rejects invalid registry %j', (patch) =>
    expect(contractManifest.safeParse({ ...manifest, ...patch }).success).toBe(
      false,
    ),
  );
});

describe('stage gate policy', () => {
  const warning: Check = {
    name: 'activity.coverage',
    status: 'WARN',
    detail: 'unavailable',
  };
  it('stops unreviewed warnings', () =>
    expect(() => requirePassingGate([warning])).toThrow());
  it('continues named reviewed warning without changing its status', () => {
    requirePassingGate([warning], ['activity.coverage']);
    expect(warning.status).toBe('WARN');
  });
  it('never overrides failure', () =>
    expect(() =>
      requirePassingGate(
        [{ ...warning, status: 'FAIL' }],
        ['activity.coverage'],
      ),
    ).toThrow());
  it('ignores unrelated warning acceptance', () =>
    expect(() => requirePassingGate([warning], ['other'])).toThrow());
});

it('Edition holding periods preserve partial quantities until exit', () => {
  const periods = editionHoldingPeriods('ERC1155', [
    event(zero, a, '5'),
    event(a, b, '2'),
    event(a, zero, '3'),
  ]);
  expect(periods[0].lostAt).toEqual(time);
  expect(periods[0].maximumQuantity).toBe('5');
  expect(periods[1].lostAt).toBeNull();
});
