import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// Placeholder is only used for `prisma generate` during install/CI.
// Runtime must set a real DATABASE_URL via environment validation.
const databaseUrl =
  process.env.DATABASE_URL ||
  'postgresql://prisma:prisma@127.0.0.1:5432/prisma?schema=public';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: databaseUrl,
  },
});
