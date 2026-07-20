import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

export const DEFAULT_DATABASE_URL = 'postgresql://postgres:1234@localhost:5432/UTMS?schema=public';

export function resolveDatabaseUrl(env: Record<string, string | undefined>): string {
  return env.DATABASE_URL || DEFAULT_DATABASE_URL;
}

export function createUtmsPrismaClient(databaseUrl = DEFAULT_DATABASE_URL): PrismaClient {
  const adapter = new PrismaPg(new Pool({ connectionString: databaseUrl }));
  return new PrismaClient({ adapter });
}
