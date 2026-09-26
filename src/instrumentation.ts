export async function register() {
  if (
    process.env.NEXT_RUNTIME === 'nodejs' &&
    process.env.NEXT_PHASE !== 'phase-production-build'
  ) {
    const { readEnv } = await import('./server/env');
    readEnv();
    const { log } = await import('./server/log');
    log('startup.config_valid');
  }
}
export async function onRequestError() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { operationalFailure } = await import('./server/operational-metrics');
    await operationalFailure('WEB_ERROR');
  }
}
