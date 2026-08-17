// One-off script to apply migrations/007_ticket_shared_at.sql against
// your actual database. Run with: node run-migration.mjs
//
// Uses @neondatabase/serverless, same as lib/db.ts, and reads DATABASE_URL
// directly out of .env.local (no dotenv needed).

import { readFileSync } from 'fs';
import { neon } from '@neondatabase/serverless';

function loadEnvLocal() {
  const text = readFileSync('.env.local', 'utf8');
  const env = {};
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

const env = loadEnvLocal();
const connectionString = env.DATABASE_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.error('Could not find DATABASE_URL in .env.local');
  process.exit(1);
}

const sql = neon(connectionString);

try {
  const existing = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'shared_at'
  `;
  if (existing.length > 0) {
    console.log('shared_at column already exists - nothing to do.');
  } else {
    await sql`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS shared_at TIMESTAMPTZ`;
    console.log('Migration applied: tickets.shared_at added successfully.');
  }
} catch (err) {
  console.error('Migration failed:', err.message);
  process.exit(1);
}
