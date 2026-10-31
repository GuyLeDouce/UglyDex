import { expect, it } from 'vitest';
import { recalculationErrorCode } from '../src/server/recalculation-error';
it('finds safe nested root causes', () => {
  expect(
    recalculationErrorCode(new Error('wrapper', { cause: { code: 'P2028' } })),
  ).toBe('P2028');
  expect(
    recalculationErrorCode(new Error('RULESET_VERSION_BUMP_REQUIRED')),
  ).toBe('RULESET_VERSION_BUMP_REQUIRED');
});
it('never exposes raw messages or arbitrary codes', () => {
  expect(
    recalculationErrorCode({
      message: 'postgres://secret',
      code: 'private-id',
    }),
  ).toBe('EVALUATION_FAILED');
});
it('handles circular errors safely', () => {
  const e: { cause?: unknown } = {};
  e.cause = e;
  expect(recalculationErrorCode(e)).toBe('EVALUATION_FAILED');
});

it('preserves the collection engine ruleset mismatch diagnostic', () => {
  expect(
    recalculationErrorCode(new Error('COLLECTION_VERSION_BUMP_REQUIRED')),
  ).toBe('COLLECTION_VERSION_BUMP_REQUIRED');
});
