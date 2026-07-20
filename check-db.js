import { sql } from "./lib/db.js";
async function check() {
  const events = await sql`SELECT * FROM events LIMIT 1`;
  console.log("Event keys:", Object.keys(events[0] || {}));
  console.log("Sample event:", events[0]);
}
check();
