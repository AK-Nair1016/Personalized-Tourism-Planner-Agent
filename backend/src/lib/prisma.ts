/*We check if a Prisma instance already exists on globalThis before creating a new one
This prevents creating 100 DB connections when the server hot-reloads in dev
globalForPrisma is just a TypeScript trick to store it globally safely*/

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
