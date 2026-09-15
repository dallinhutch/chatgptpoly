import { transaction, migrate } from "../src/db";
await transaction(async (q) => {
  if (!process.env.LOCAL_DATABASE_PATH)
    await q.query("SELECT pg_advisory_xact_lock(710031)");
  await migrate(q);
});
console.log("Migrations applied");
process.exit(0);
