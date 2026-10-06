import 'dotenv/config';
import { spawnSync } from 'node:child_process';

const required = ['SUPABASE_DB_PASSWORD', 'SUPABASE_PROJECT_REF', 'SUPABASE_POOLER_HOST', 'JWT_SECRET'];
const missing = required.filter((key) => !process.env[key] || process.env[key].startsWith('replace-'));
if (missing.length) {
  console.error(`\nMissing configuration: ${missing.join(', ')}\nCopy .env.example to .env and replace the placeholder values.\n`);
  process.exit(1);
}
if (process.env.JWT_SECRET.length < 32) {
  console.error('\nJWT_SECRET must contain at least 32 characters.\n');
  process.exit(1);
}
const password = encodeURIComponent(process.env.SUPABASE_DB_PASSWORD);
const ref = process.env.SUPABASE_PROJECT_REF;
const host = process.env.SUPABASE_POOLER_HOST;
const username = `postgres.${ref}`;
const common = `${username}:${password}@${host}`;
const env = {
  ...process.env,
  DATABASE_URL: `postgresql://${common}:6543/postgres?pgbouncer=true&connection_limit=5`,
  DIRECT_URL: `postgresql://${common}:5432/postgres`,
};

function run(label, command, args) {
  console.log(`\n→ ${label}`);
  const result = spawnSync(command, args, { stdio: 'inherit', env, shell: process.platform === 'win32' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run('Generating Prisma client', 'npx', ['prisma', 'generate']);
run('Synchronizing the database schema', 'npx', ['prisma', 'db', 'push']);
run('Checking TypeScript', 'npx', ['tsc', '--noEmit']);
console.log('\n✓ VyraDee server setup is complete. Run: npm run dev\n');
