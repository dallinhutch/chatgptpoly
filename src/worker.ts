import { db, transaction, audit } from "./db";
import {
  scan,
  job,
  executePaper,
  resolvePosition,
  snapshot,
  saveMarket,
  saveBook,
} from "./engine";
import { research } from "./research";
import { book, marketBySlug, settlement } from "./polymarket";
import pg from "pg";
import { persistResearch } from "./persist-research";
import { reviewPosition } from "./monitor";
import { runActive, researchWindowOpen } from "./run-window";
import { adaptConfidence } from "./adapt";

let stopping = false;
process.on("SIGTERM", () => {
  stopping = true;
});
process.on("SIGINT", () => {
  stopping = true;
});
// A session-scoped lock prevents overlapping workers and duplicate AI spend.
const lock = await (db() as pg.Pool).connect();
if (
  !(await lock.query("SELECT pg_try_advisory_lock(710032) AS acquired")).rows[0]
    .acquired
)
  throw Error("Another worker owns the lease");
while (!stopping) {
  try {
    for (const row of (
      await db().query(
        "SELECT DISTINCT m.slug FROM positions p JOIN markets m ON m.id=p.market_id WHERE p.closed_at IS NULL",
      )
    ).rows) {
      try {
        const m = await marketBySlug(row.slug);
        await saveMarket(db(), m);
        await saveBook(db(), m.id, await book(m.slug));
        if (m.status === "MARKET_STATUS_RESOLVED") {
          const outcome = await settlement(m.slug);
          await transaction((q) =>
            resolvePosition(q, m.id, String(outcome.settlement), {
              market: m,
              settlement: outcome,
            }),
          );
        } else {
          const p = (
            await db().query(
              "SELECT id FROM positions WHERE market_id=$1 AND closed_at IS NULL",
              [m.id],
            )
          ).rows[0];
          if (p)
            await transaction(async (q) =>
              reviewPosition(
                q,
                p.id,
                m,
                await book(m.slug),
                process.env.PAPER_TRADING_ENABLED === "true" && runActive(),
              ),
            );
        }
      } catch (e) {
        await job(db(), "monitor", "failed", {
          message: e instanceof Error ? e.message : "Unknown",
        });
      }
    }
    await transaction(snapshot);
    const candidates = await scan(db());
    await adaptConfidence();
    if (process.env.RESEARCH_ENABLED === "true" && process.env.OPENAI_API_KEY && researchWindowOpen()) {
      const used = Number(
        (
          await db().query(
            "SELECT COUNT(*) AS count FROM research_budget_reservations WHERE created_at >= date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'",
          )
        ).rows[0].count,
      );
      const max = Number(process.env.MAX_RESEARCH_RUNS_PER_DAY ?? 3);
      const last = (await db().query("SELECT MAX(created_at) AS at FROM research_budget_reservations WHERE created_at >= $1", [process.env.RUN_START_AT ?? "1970-01-01T00:00:00Z"])).rows[0].at;
      const spaced = !last || Date.now() - new Date(last).getTime() >= Number(process.env.RESEARCH_INTERVAL_MINUTES ?? 0) * 60000;
      if (used < max && spaced) {
        let candidate;
        for (const c of candidates.filter((c) => c.eligible)) {
          const recent = (
            await db().query(
              "SELECT id FROM research_runs WHERE market_id=$1 AND created_at>now()-interval '6 hours'",
              [c.market.id],
            )
          ).rows.length;
          if (!recent) {
            candidate = c;
            break;
          }
        }
        if (candidate) {
          const m = candidate.market;
          const recent = (
            await db().query(
              "SELECT id FROM research_runs WHERE market_id=$1 AND created_at>now()-interval '6 hours'",
              [m.id],
            )
          ).rows.length;
          if (!recent) {
            await job(
              db(),
              "research",
              "started",
              { model: process.env.OPENAI_MODEL },
              m.id,
            );
            const version = (
              await db().query(
                "SELECT id FROM strategy_versions ORDER BY id DESC LIMIT 1",
              )
            ).rows[0];
            const result = await research(m);
            const id = await persistResearch(m.id, version.id, result);
            await job(db(), "research", "completed", { researchId: id }, m.id);
            if (runActive()) {
              const latest = await marketBySlug(m.slug),
                b = await book(m.slug);
              await transaction((q) => executePaper(q, String(id), latest, b, new Date(), true));
              if (process.env.PAPER_TRADING_ENABLED === "true") await transaction((q) => executePaper(q, String(id), latest, b));
            }
          }
        }
      }
    } else
      await job(db(), "research", "disabled", {
        reason: "Configure an API key and enable research",
      });
    await job(db(), "heartbeat", "completed", { at: new Date().toISOString() });
  } catch (e) {
    console.error(e instanceof Error ? e.message : "Worker error");
    await job(db(), "worker", "failed", {
      message: e instanceof Error ? e.message : "Unknown",
    }).catch(() => {});
  }
  const delay =
    Math.max(15, Number(process.env.SCAN_INTERVAL_SECONDS ?? 60)) * 1000;
  for (let waited = 0; waited < delay && !stopping; waited += 1000)
    await new Promise((r) => setTimeout(r, 1000));
}
await lock.query("SELECT pg_advisory_unlock(710032)");
lock.release();
process.exit(0);
