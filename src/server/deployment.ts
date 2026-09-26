import 'server-only';
import { createHash } from 'node:crypto';
import { db } from './db';
import {
  appEnvironment,
  databaseFingerprint,
  operationalIntent,
} from '@/domain/deployment';
export async function assertOperation(action: string) {
  operationalIntent(action);
  await assertDeploymentBinding();
}
export async function assertDeploymentBinding() {
  const environment = appEnvironment();
  if (environment === 'development') return;
  const identity = await db().deploymentIdentity.findUnique({
    where: { id: 'instance' },
  });
  if (
    !identity ||
    identity.environment !== environment ||
    identity.databaseFingerprint !==
      databaseFingerprint(process.env.DATABASE_URL!)
  )
    throw new Error('DEPLOYMENT_IDENTITY_MISMATCH');
}
export async function registerDeployment() {
  const environment = operationalIntent('register');
  const fingerprint = databaseFingerprint(process.env.DATABASE_URL!);
  const prior = await db().deploymentIdentity.findUnique({
    where: { id: 'instance' },
  });
  if (
    prior &&
    (prior.environment !== environment ||
      prior.databaseFingerprint !== fingerprint)
  )
    throw new Error('DEPLOYMENT_IDENTITY_MISMATCH');
  return db().deploymentIdentity.upsert({
    where: { id: 'instance' },
    create: { id: 'instance', environment, databaseFingerprint: fingerprint },
    update: {},
  });
}
export async function deploymentChecks(staging = false) {
  const environment = appEnvironment();
  const row = await db().deploymentIdentity.findUnique({
    where: { id: 'instance' },
  });
  const fingerprint = databaseFingerprint(process.env.DATABASE_URL!);
  const valid =
    row?.environment === environment && row.databaseFingerprint === fingerprint;
  const checks: import('@/domain/operations').Check[] = [
    {
      name: 'deployment.identity',
      status: valid ? 'PASS' : 'FAIL',
      detail: `${environment}; database binding ${valid ? 'validated' : 'missing or mismatched'}`,
    },
  ];
  if (staging) {
    const secretReference = process.env.PRODUCTION_AUTH_SECRET_SHA256;
    const matches =
      secretReference &&
      process.env.AUTH_SECRET &&
      createHash('sha256').update(process.env.AUTH_SECRET).digest('hex') ===
        secretReference;
    checks.push({
      name: 'staging.auth_isolation',
      status: matches ? 'FAIL' : secretReference ? 'PASS' : 'WARN',
      detail:
        'Use a separate staging AUTH_SECRET; absent production secret fingerprint requires manual isolation evidence',
    });
    const reference = process.env.PRODUCTION_DATABASE_FINGERPRINT;
    checks.push({
      name: 'staging.isolation',
      status:
        environment !== 'staging' || reference === fingerprint
          ? 'FAIL'
          : reference
            ? 'PASS'
            : 'WARN',
      detail:
        'Requires staging identity and a different production database fingerprint; hostname aliases must also be reviewed',
    });
    checks.push({
      name: 'staging.origin',
      status:
        process.env.PUBLIC_BASE_URL === process.env.STAGING_BASE_URL &&
        !!process.env.STAGING_BASE_URL &&
        process.env.PUBLIC_BASE_URL !== process.env.PRODUCTION_BASE_URL
          ? 'PASS'
          : 'FAIL',
      detail:
        'Explicit staging URL must match canonical origin and differ from production',
    });
  }
  return checks;
}
