import fs from 'fs';
import path from 'path';

// Manually load .env.local to ensure environment variables are present
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split(/\r?\n/).forEach(line => {
    const match = line.match(/^([^=:#]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      process.env[key] = value;
    }
  });
}

import { sql } from './lib/db';

async function verifyAndSeed() {
  try {
    console.log('Checking database connection and tables...');
    
    // Check events table or insert a test event if none exist
    const events = await sql`SELECT id, slug FROM events LIMIT 1`;
    let eventId = '7d452829-f896-44d1-bb00-c83c5749820d';
    
    if (events.length === 0) {
      console.log('No events found. Inserting a default test event...');
      await sql`
        INSERT INTO events (id, title, slug, description, date, location, status, organizer_id)
        VALUES (${eventId}, 'Test Event', 'test-event', 'Sample description for testing checkout', NOW() + INTERVAL '7 days', 'Nairobi', 'published', '00000000-0000-0000-0000-000000000000')
        ON CONFLICT (id) DO NOTHING;
      `;
    } else {
      eventId = events[0].id;
      console.log(`Found existing event ID: ${eventId} (slug: ${events[0].slug})`);
    }

    // Insert test ticket type
    console.log('Inserting test ticket type...');
    await sql`
      INSERT INTO ticket_types (event_id, name, price_kes, quantity_total, quantity_sold, max_per_order)
      VALUES (${eventId}, 'Regular', 1000, 100, 0, 5)
      ON CONFLICT DO NOTHING;
    `;

    console.log('Database verification and test ticket seeding completed successfully!');
  } catch (err) {
    console.error('Database check/seed failed:', err);
  }
  process.exit(0);
}

verifyAndSeed();