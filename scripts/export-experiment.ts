import { writeFile } from "node:fs/promises";
import { db, closeDatabase } from "../src/db";
const tables = [
  "markets",
  "market_price_history",
  "research_runs",
  "research_sources",
  "analyst_predictions",
  "research_budget_reservations",
  "system_jobs",
  "audit_events",
  "portfolio_snapshots",
];
const output: Record<string, unknown> = {};
for (const table of tables)
  output[table] = (await db().query("SELECT * FROM " + table)).rows;
await writeFile(process.argv[2], JSON.stringify(output));
await closeDatabase();
console.log("Experiment exported without credentials.");
