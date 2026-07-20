import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'database/prisma/schema.prisma',
  migrations: {
    path: 'database/prisma/migrations',
    seed: 'node database/prisma/seed/index.cjs',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
