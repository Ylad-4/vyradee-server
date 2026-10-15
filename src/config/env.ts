import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGIN: z.string().default('http://localhost:8081,http://127.0.0.1:8081'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must contain at least 32 characters'),
  DATABASE_URL: z.string().url().optional(),
  DIRECT_URL: z.string().url().optional(),
  SUPABASE_DB_PASSWORD: z.string().min(1).optional(),
  SUPABASE_PROJECT_REF: z.string().min(1).optional(),
  SUPABASE_POOLER_HOST: z.string().min(1).optional(),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-2.5-flash'),
  META_APP_ID: z.string().optional(),
  META_APP_SECRET: z.string().optional(),
  META_REDIRECT_URI: z.string().url().optional(),
  META_GRAPH_VERSION: z.string().default('v24.0'),
});

const values = schema.parse(process.env);
let databaseUrl = values.DATABASE_URL;
let directUrl = values.DIRECT_URL;
const isExampleUrl = (url: string | undefined) => Boolean(url && /USER:PASSWORD@HOST|replace-with/i.test(url));
if (isExampleUrl(databaseUrl) || isExampleUrl(directUrl)) {
  throw new Error('Replace the example DATABASE_URL and DIRECT_URL values with connection strings from your PostgreSQL provider');
}

// Keep existing Supabase deployments working while allowing any PostgreSQL
// provider (including Neon) to supply standard Prisma connection URLs.
if (!databaseUrl && values.SUPABASE_DB_PASSWORD) {
  if (!values.SUPABASE_PROJECT_REF || !values.SUPABASE_POOLER_HOST) {
    throw new Error('SUPABASE_PROJECT_REF and SUPABASE_POOLER_HOST are required with SUPABASE_DB_PASSWORD');
  }
  const authority = `postgres.${values.SUPABASE_PROJECT_REF}:${encodeURIComponent(values.SUPABASE_DB_PASSWORD)}@${values.SUPABASE_POOLER_HOST}`;
  databaseUrl = `postgresql://${authority}:6543/postgres?pgbouncer=true&connection_limit=5`;
  directUrl ??= `postgresql://${authority}:5432/postgres`;
}

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required (or configure the legacy Supabase database variables)');
}

export const env = {
  ...values,
  DATABASE_URL: databaseUrl,
  DIRECT_URL: directUrl ?? databaseUrl,
};
