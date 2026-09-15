import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { db, migrate, closeDatabase } from "../src/db";
import { reserveResearch } from "../src/budget";

test("run budget reserves at most ten dollars and rejects calls after its deadline", async () => {
  process.env.LOCAL_DATABASE_PATH = await mkdtemp(join(tmpdir(), "polylab-budget-"));
  process.env.RUN_START_AT = new Date(Date.now() - 1000).toISOString();
  process.env.RUN_END_AT = new Date(Date.now() + 3600000).toISOString();
  process.env.RESEARCH_DAILY_RESERVE_USD = "100";
  process.env.RESEARCH_LIFETIME_RESERVE_USD = "100";
  try {
    await migrate(db());
    await db().query("INSERT INTO markets(id,slug,question,category,rules,raw) VALUES('budget-test','budget-test','test','test','test','{}')");
    for (let i = 0; i < 5; i++) await reserveResearch("budget-test");
    await assert.rejects(reserveResearch("budget-test"), /cap reached/);
    assert.equal(Number((await db().query("SELECT SUM(reserved_usd) AS total FROM research_budget_reservations")).rows[0].total), 10);
    process.env.RUN_END_AT = new Date(Date.now() - 1).toISOString();
    await assert.rejects(reserveResearch("budget-test"), /authorized time window/);
  } finally { await closeDatabase(); }
});
