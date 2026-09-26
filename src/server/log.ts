// Only bounded, explicitly selected operational fields. Never log error messages or rows.
export function log(
  event: string,
  fields: Record<string, string | number | boolean | null> = {},
) {
  console.log(
    JSON.stringify({ time: new Date().toISOString(), event, ...fields }),
  );
}
export function errorCode(error: unknown): string {
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String(error.code)
      : '';
  return /^[A-Z0-9_]{2,40}$/.test(code) ? code : 'OPERATION_FAILED';
}
