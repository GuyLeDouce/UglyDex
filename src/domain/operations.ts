import { z } from 'zod';
export const services = [
  'blockchain',
  'ecosystem',
  'progression',
  'collections',
] as const;
export const workerMode = z.enum(['DISABLED', 'HISTORICAL', 'LIVE']);
export const workerControlSchema = z
  .object({ service: z.enum(services), mode: workerMode })
  .strict();
export type Service = (typeof services)[number];
export type WorkerMode = z.infer<typeof workerMode>;
export const backfillStages = [
  'catalog',
  'transfers',
  'provenance',
  'identity',
  'activity',
  'progression',
  'collections',
  'verification',
] as const;
export type BackfillStage = (typeof backfillStages)[number];
export type Check = {
  name: string;
  status: 'PASS' | 'WARN' | 'FAIL';
  detail: string;
};
export function heartbeatState(time: Date, state: string, now = new Date()) {
  return now.getTime() - time.getTime() > 90000 ? 'STALE' : state;
}
export function safeOperationalCode(error: unknown) {
  return error instanceof Error && /^[A-Z][A-Z0-9_]{2,70}$/.test(error.message)
    ? error.message
    : 'OPERATION_FAILED';
}
