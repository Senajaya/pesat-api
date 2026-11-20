import path from 'node:path';
import { defineConfig, env } from 'prisma/config';

try {
  process.loadEnvFile(path.resolve(__dirname, '.env'));
} catch {
  // Abaikan jika file .env tidak ada (misalnya di produksi)
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: env('DATABASE_URL'),
  },
});