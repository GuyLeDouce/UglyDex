import { z } from 'zod';
export async function jsonBody(request: Request) {
  if (Number(request.headers.get('content-length') ?? 0) > 16384)
    throw new Error('BODY_TOO_LARGE');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('INVALID_BODY');
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    length += chunk.value.length;
    if (length > 16384) {
      await reader.cancel();
      throw new Error('BODY_TOO_LARGE');
    }
    chunks.push(chunk.value);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
export function authError(error: unknown) {
  const code = error instanceof Error ? error.message : '';
  const allowed = [
    'ORIGIN_REJECTED',
    'RATE_LIMITED',
    'INVALID_CHALLENGE',
    'INVALID_SIGNATURE',
    'IDENTITY_REVIEW_REQUIRED',
    'AUTH_UNCONFIGURED',
    'INVALID_BODY',
    'BODY_TOO_LARGE',
  ];
  const message =
    error instanceof z.ZodError
      ? 'INVALID_INPUT'
      : allowed.includes(code)
        ? code
        : 'AUTH_UNAVAILABLE';
  return Response.json(
    { error: message },
    {
      status:
        message === 'RATE_LIMITED'
          ? 429
          : message === 'AUTH_UNAVAILABLE' || message === 'AUTH_UNCONFIGURED'
            ? 503
            : 400,
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}
