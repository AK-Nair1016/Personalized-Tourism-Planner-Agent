import { PrismaClient } from '@prisma/client';
import { loadEnv } from './env';

loadEnv();

function normalizeDatabaseUrl(url: string) {
  if (!url) return url;

  try {
    const parsed = new URL(url);
    const sslmode = parsed.searchParams.get('sslmode');
    const deprecatedSslModes = new Set(['prefer', 'require', 'verify-ca']);

    if (sslmode && deprecatedSslModes.has(sslmode)) {
      parsed.searchParams.set('sslmode', 'verify-full');
      return parsed.toString();
    }
  } catch {
    // ignore parsing errors
  }

  return url;
}

const databaseUrl = normalizeDatabaseUrl(process.env.DATABASE_URL ?? '');

if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL is not set. Add it to backend/.env or your runtime environment.'
  );
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['error', 'warn'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}