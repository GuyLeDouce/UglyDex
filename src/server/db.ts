import 'server-only';
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { readEnv } from './env';
const globalDb = globalThis as unknown as { uglydexDb?: PrismaClient };
export function db() {
  if (!globalDb.uglydexDb)
    globalDb.uglydexDb = new PrismaClient({
      adapter: new PrismaPg({
        connectionString: readEnv().DATABASE_URL,
        max: readEnv().DB_POOL_MAX,
        connectionTimeoutMillis: 5000,
        statement_timeout: 15000,
      }),
    });
  return globalDb.uglydexDb;
}
