// Never log raw database errors: they can contain query parameters or credentials.
export function recalculationErrorCode(error: unknown): string {
  const allowed = new Set([
    'DEPLOYMENT_IDENTITY_MISMATCH',
    'APP_ENV_REQUIRED',
    'RULESET_VERSION_BUMP_REQUIRED',
    'UNKNOWN_CANONICAL_TRAIT_REQUIRES_VERSION',
    'COLLECTIONS_NOT_SEEDED',
    'COLLECTION_STARTUP_BLOCKED',
    'COLLECTION_STARTUP_STALLED',
    'P1001',
    'P1002',
    'P1008',
    'P2024',
    'P2028',
    'P2034',
    '40001',
    '40P01',
  ]);
  const seen = new Set<object>();
  function visit(value: unknown, depth: number): string | undefined {
    if (!value || typeof value !== 'object' || depth > 8 || seen.has(value))
      return;
    seen.add(value);
    const row = value as Record<string, unknown>;
    for (const key of ['cause', 'meta', 'driverAdapterError']) {
      const nested = visit(row[key], depth + 1);
      if (nested) return nested;
    }
    for (const key of ['code', 'originalCode', 'message']) {
      if (typeof row[key] === 'string' && allowed.has(row[key]))
        return row[key];
    }
  }
  return visit(error, 0) ?? 'EVALUATION_FAILED';
}
