/**
 * One-off: encrypts existing plaintext users.totp_secret values with
 * TOTP_ENCRYPTION_KEY. Safe to re-run (already-encrypted rows are skipped).
 *
 *   $env:DATABASE_URL="..."; $env:TOTP_ENCRYPTION_KEY="..."
 *   npx tsx scripts/encrypt-totp-secrets.ts
 */
import { neon } from '@neondatabase/serverless';
import { protectTotpSecret, isProtectedTotpSecret } from '../lib/totp';

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
  if (!process.env.TOTP_ENCRYPTION_KEY) throw new Error('TOTP_ENCRYPTION_KEY is not set');
  const sql = neon(process.env.DATABASE_URL);

  const rows = await sql`SELECT id, totp_secret FROM users WHERE totp_secret IS NOT NULL`;
  let encrypted = 0;
  let skipped = 0;
  for (const row of rows as any[]) {
    const current = String(row.totp_secret);
    if (isProtectedTotpSecret(current)) {
      skipped++;
      continue;
    }
    const next = protectTotpSecret(current);
    // Guarded on the old value so a concurrent change is never overwritten.
    await sql`UPDATE users SET totp_secret = ${next} WHERE id = ${row.id} AND totp_secret = ${current}`;
    encrypted++;
  }
  console.log(`Encrypted ${encrypted} secret(s); ${skipped} already encrypted.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
