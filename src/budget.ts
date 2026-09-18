import { transaction, audit, type DB } from "./db";
import { accountedCost } from "./cost-accounting";
import { assertRunActive } from "./run-window";
export async function budgetUsage(q: DB) {
  const rows = (await q.query("SELECT * FROM research_budget_reservations")).rows;
  const responses = (await q.query("SELECT status,detail FROM system_jobs WHERE kind='analyst_response' AND detail ? 'reservationId'")).rows;
  const start = Date.parse(process.env.RUN_START_AT ?? "1970-01-01T00:00:00Z");
  const day = new Date().toISOString().slice(0,10);
  let lifetime=0,daily=0,run=0;
  for (const r of rows) {
    const cost = process.env.RECONCILE_COMPLETED_RESEARCH === "true"
      ? accountedCost(Number(r.reserved_usd),responses.filter(x=>String(x.detail.reservationId)===String(r.id))) : Number(r.reserved_usd);
    lifetime += cost;
    if (new Date(r.created_at).toISOString().startsWith(day)) daily += cost;
    if (new Date(r.created_at).getTime() >= start) run += cost;
  }
  return {lifetime,daily,run};
}
/** Failed/unfinished batches retain their full reservation. No automatic API retries. */
export async function reserveResearch(marketId: string) {
  return transaction(async (q) => {
    assertRunActive();
    await q.query("SELECT id FROM portfolio WHERE id=1 FOR UPDATE");
    const row = await budgetUsage(q);
    const daily = Number(process.env.RESEARCH_DAILY_RESERVE_USD ?? 1),
      lifetime = Number(process.env.RESEARCH_LIFETIME_RESERVE_USD ?? 5);
    const amount = process.env.RUN_END_AT ? 2 : 1;
    if (process.env.RUN_END_AT) {
      const used = row.run;
      const cap = Number(process.env.RUN_API_BUDGET_USD ?? 10);
      if (!Number.isFinite(cap) || cap < 0 || used + amount > cap) throw Error("Run API reservation cap reached");
    }
    if (
      !Number.isFinite(daily) ||
      !Number.isFinite(lifetime) ||
      Number(row.daily) + amount > daily ||
      Number(row.lifetime) + amount > lifetime
    )
      throw Error("Research reservation budget exhausted");
    const id = (
      await q.query(
        "INSERT INTO research_budget_reservations(reserved_usd,market_id) VALUES($2,$1) RETURNING id",
        [marketId, amount],
      )
    ).rows[0].id;
    await audit(q, "RESEARCH_BUDGET_RESERVED", {
      id,
      marketId,
      reservedUsd: amount,
    });
    return id;
  });
}
