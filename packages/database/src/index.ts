import { PrismaClient } from '../generated/client';

declare global {
  // eslint-disable-next-line no-var
  var __decoyPrisma__: PrismaClient | undefined;
}

function createClient() {
  return new PrismaClient();
}

export const prisma = globalThis.__decoyPrisma__ ?? createClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__decoyPrisma__ = prisma;
}

export * from '../generated/client';
