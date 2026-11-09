import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { config } from '../config.js';
import * as schema from './schema.js';

export const pool = config.DATABASE_URL ? new Pool({ connectionString: config.DATABASE_URL, max: 10 }) : null;
export const db = pool ? drizzle(pool, { schema }) : null;

export async function checkDatabase(): Promise<boolean> {
  if (!pool) return false;
  await pool.query('select 1');
  return true;
}
