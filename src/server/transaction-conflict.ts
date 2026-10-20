// PostgreSQL serialization failures/deadlocks are retryable contention, not
// corrupt evidence. Prisma can expose them directly or through its adapter.
export function isTransactionConflict(error: unknown): boolean {
  const seen = new Set<object>();
  function visit(value: unknown, depth: number): boolean {
    if (!value || typeof value !== 'object' || depth > 8 || seen.has(value))
      return false;
    seen.add(value);
    const record = value as Record<string, unknown>;
    if (
      ['P2034', '40001', '40P01'].includes(String(record.code)) ||
      ['40001', '40P01'].includes(String(record.originalCode)) ||
      record.kind === 'TransactionWriteConflict'
    )
      return true;
    return ['cause', 'meta', 'driverAdapterError'].some((key) =>
      visit(record[key], depth + 1),
    );
  }
  return visit(error, 0);
}
