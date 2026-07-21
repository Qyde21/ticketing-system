require('dotenv').config({ path: '.env.local' });
const postgres = require('postgres');
const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.error('No database connection string found in environment variables.');
  process.exit(1);
}

const sql = postgres(connectionString);

async function run() {
  try {
    await sql`INSERT INTO ticket_types (event_id, name, price_kes, quantity_total, quantity_sold, max_per_order) VALUES ('7d452829-f896-44d1-bb00-c83c5749820d', 'Regular', 1000, 100, 0, 5)`;
    console.log('Test ticket inserted successfully!');
  } catch (err) {
    console.error('Error inserting ticket (might already exist):', err.message);
  }
  await sql.end();
  process.exit(0);
}
run();