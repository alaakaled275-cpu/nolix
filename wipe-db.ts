import { query } from "./lib/db";

async function executeWipe() {
  try {
    console.log("Wiping waitlist table...");
    await query("TRUNCATE TABLE waitlist;");
    console.log("Waitlist table wiped successfully.");
  } catch (err) {
    console.error("Error wiping waitlist:", err);
  } finally {
    process.exit(0);
  }
}

executeWipe();
