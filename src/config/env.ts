import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGIN: z.string().default('*'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must contain at least 32 characters'),
  SUPABASE_DB_PASSWORD: z.string().min(1, 'SUPABASE_DB_PASSWORD is required'),
  SUPABASE_PROJECT_REF: z.string().min(1).default('jmfgalpnotsfexyhxnrj'),
  SUPABASE_POOLER_HOST: z.string().min(1).default('aws-0-eu-west-1.pooler.supabase.com'),
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
const password = encodeURIComponent(values.SUPABASE_DB_PASSWORD);
const username = `postgres.${values.SUPABASE_PROJECT_REF}`;
const authority = `${username}:${password}@${values.SUPABASE_POOLER_HOST}`;

export const env = {
  ...values,
  DATABASE_URL: `postgresql://${authority}:6543/postgres?pgbouncer=true&connection_limit=5`,
  DIRECT_URL: `postgresql://${authority}:5432/postgres`,
};
