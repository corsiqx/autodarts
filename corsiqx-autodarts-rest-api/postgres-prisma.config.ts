import 'dotenv/config';
import path from 'node:path';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: path.join('postgres-prisma', 'schema.prisma'),
  migrations: {
    path: path.join('postgres-prisma', 'migrations'),
  },
  datasource: {
    url: env('POSTGRES_DATABASE_URL'),
  },
});
