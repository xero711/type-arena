import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  WEB_ORIGIN: z.string().default('http://localhost:5173'),
  DATABASE_URL: z.string().url().optional(),
  FIREBASE_PROJECT_ID: z.preprocess((value) => value === '' ? undefined : value, z.string().optional()),
  FIREBASE_CLIENT_EMAIL: z.preprocess((value) => value === '' ? undefined : value, z.string().email().optional()),
  FIREBASE_PRIVATE_KEY: z.preprocess((value) => value === '' ? undefined : value, z.string().optional()),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  throw new Error(`Invalid server configuration: ${parsed.error.issues.map((issue) => issue.path.join('.')).join(', ')}`);
}

export const config = parsed.data;
