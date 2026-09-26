import { createHash } from 'node:crypto';
export type AppEnvironment = 'development' | 'staging' | 'production';
export function appEnvironment(
  env: Record<string, string | undefined> = process.env,
): AppEnvironment {
  const value =
    env.APP_ENV ?? (env.NODE_ENV === 'production' ? '' : 'development');
  if (!['development', 'staging', 'production'].includes(value))
    throw new Error('APP_ENV_REQUIRED');
  return value as AppEnvironment;
}
export function databaseFingerprint(value: string) {
  const u = new URL(value);
  if (
    !['postgres:', 'postgresql:'].includes(u.protocol) ||
    u.searchParams.has('host')
  )
    throw new Error('INVALID_DATABASE_TARGET');
  return createHash('sha256')
    .update(
      `${u.hostname.toLowerCase()}:${u.port || '5432'}${decodeURIComponent(u.pathname)}`,
    )
    .digest('hex');
}
export function operationalIntent(
  action: string,
  env: Record<string, string | undefined> = process.env,
) {
  const environment = appEnvironment(env);
  if (
    environment !== 'development' &&
    (env.OPS_CONFIRM !== `${environment}:${action}` ||
      env.OPS_DATABASE_FINGERPRINT !==
        databaseFingerprint(env.DATABASE_URL ?? ''))
  )
    throw new Error('OPERATION_CONFIRMATION_REQUIRED');
  return environment;
}
export function restoreTarget(env: Record<string, string | undefined>) {
  if (env.RESTORE_DRILL_CONFIRM !== 'RESTORE_INTO_EMPTY_DISPOSABLE_DATABASE')
    throw new Error('RESTORE_CONFIRMATION_REQUIRED');
  const target = new URL(env.RESTORE_TARGET_URL ?? '');
  if (
    !/^\/uglydex_restore_[a-z0-9_]{6,60}$/.test(target.pathname) ||
    /prod/i.test(target.hostname + target.pathname)
  )
    throw new Error('RESTORE_TARGET_NOT_DISPOSABLE');
  const fingerprint = databaseFingerprint(target.href);
  if (
    !env.DATABASE_URL ||
    fingerprint === databaseFingerprint(env.DATABASE_URL) ||
    (env.PRODUCTION_DATABASE_FINGERPRINT &&
      fingerprint === env.PRODUCTION_DATABASE_FINGERPRINT)
  )
    throw new Error('RESTORE_SOURCE_EQUALS_TARGET');
  return target;
}
