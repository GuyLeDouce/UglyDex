import { z } from 'zod';
export const charmDirections = [
  'EARN',
  'SPEND',
  'PAYOUT',
  'REFUND',
  'WAGER',
  'OBSERVATION',
] as const;
const blankOptional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (v === '' ? undefined : v), schema.optional());
export const charmFilter = z.object({
  source: blankOptional(
    z
      .string()
      .regex(/^[a-zA-Z]+$/)
      .max(40),
  ),
  direction: blankOptional(z.enum(charmDirections)),
  from: blankOptional(z.iso.date()),
  to: blankOptional(z.iso.date()),
  page: z.coerce.number().int().min(1).max(10000).catch(1),
});
export const DRIP_MONTHLY_BUDGET = 30000;
export function dripHeaderSpacing(
  rate: { limit: number | null; window: number | null } | null,
  rpm = 6,
) {
  const owned = Math.ceil(60000 / rpm);
  if (!rate?.limit || rate.limit < 1) return owned;
  return Math.max(owned, Math.ceil(((rate.window ?? 60) * 1000) / rate.limit));
}
export function dripBudget(
  state: { month: string; monthRequests: number; nextRequestAt: Date },
  now: Date,
  rpm = 6,
) {
  if (!Number.isInteger(rpm) || rpm < 1 || rpm > 6)
    throw Error('DRIP_RPM_RANGE');
  const month = now.toISOString().slice(0, 7);
  const used = state.month === month ? state.monthRequests : 0;
  return {
    allowed: used < DRIP_MONTHLY_BUDGET && +now >= +state.nextRequestAt,
    month,
    monthRequests: used + 1,
    nextRequestAt: new Date(+now + Math.ceil(60000 / rpm)),
  };
}
export function balanceView(
  row: {
    balance: { toString(): string } | string | null;
    observedAt: Date | null;
    status: string;
  } | null,
  now = new Date(),
  staleAfter = 300000,
) {
  return {
    balance: row?.balance?.toString() ?? null,
    updatedAt: row?.observedAt?.toISOString() ?? null,
    ageMinutes: row?.observedAt
      ? Math.max(0, Math.floor((+now - +row.observedAt) / 60000))
      : null,
    status: row?.status ?? 'UNKNOWN',
    stale:
      !row?.observedAt ||
      +now - +row.observedAt > staleAfter ||
      row.status !== 'CURRENT',
  };
}
export function publicCharm(
  show: boolean,
  balance: ReturnType<typeof balanceView>,
) {
  return show &&
    balance.balance !== null &&
    balance.status !== 'CONFLICT' &&
    balance.status !== 'UNRESOLVED'
    ? balance
    : null;
}
