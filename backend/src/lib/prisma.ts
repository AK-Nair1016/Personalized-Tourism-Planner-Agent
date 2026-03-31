import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config({ quiet: true });

const databaseUrl = process.env.DATABASE_URL ?? '';

if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL is not set. Add it to backend/.env or your runtime environment.',
  );
}

function isAccelerateUrl(url: string) {
  return url.startsWith('prisma://') || url.startsWith('prisma+postgres://');
}

function createPrismaClient() {
  if (isAccelerateUrl(databaseUrl)) {
    return new PrismaClient({
      accelerateUrl: databaseUrl,
    });
  }

  try {
    // Lazy require keeps this file loadable even if adapter deps are not installed yet.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { PrismaPg } = require('@prisma/adapter-pg') as {
      PrismaPg: new (opts: { connectionString: string }) => unknown;
    };

    const adapter = new PrismaPg({ connectionString: databaseUrl });
    return new PrismaClient({ adapter: adapter as any });
  } catch {
    throw new Error(
      'Prisma 7 requires @prisma/adapter-pg for postgresql:// DATABASE_URL values. ' +
        'Run `npm install @prisma/adapter-pg pg` in backend/, then restart the server.',
    );
  }
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
