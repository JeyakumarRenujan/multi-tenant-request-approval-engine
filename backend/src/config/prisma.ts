import { PrismaClient } from '@prisma/client';

// Singleton instance of PrismaClient to prevent connection exhaustion
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});
