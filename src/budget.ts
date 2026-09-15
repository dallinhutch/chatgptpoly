import { transaction, audit } from "./db";
import { assertRunActive } from "./run-window";
/** Conservative reservation stays consumed even after failure; no silent automatic retries. */
export async function reserveResearch(marketId: string) {
  return transaction(async (q) => {
    assertRunActive();
    await q.query("SELECT id FROM portfolio WHERE id=1 FOR UPDATE");
    const row = (
      await q.query(
        "SELECT COALESCE(SUM(reserved_usd),0) AS lifetime,COALESCE(SUM(reserved_usd) FILTER(WHERE created_at >= date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'),0) AS daily FROM research_budget_reservations",
      )
    ).rows[0];
    const daily = Number(process.env.RESEARCH_DAILY_RESERVE_USD ?? 1),
      lifetime = Number(process.env.RESEARCH_LIFETIME_RESERVE_USD ?? 5);
    const amount = process.env.RUN_END_AT ? 2 : 1;
    if (process.env.RUN_END_AT) {
      const used = Number((await q.query("SELECT COALESCE(SUM(reserved_usd),0) AS used FROM research_budget_reservations WHERE created_at >= $1", [process.env.RUN_START_AT])).rows[0].used);
      if (used + amount > 10) throw Error("Eight-hour run API reservation cap reached");
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
