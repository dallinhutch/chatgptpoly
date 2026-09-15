import { db, transaction } from "../src/db";
import { screen, job, executePaper } from "../src/engine";
import { book, marketBySlug } from "../src/polymarket";
import { strategySchema } from "../src/config";
import { research } from "../src/research";
import { persistResearch } from "../src/persist-research";
const version = (
  await db().query("SELECT * FROM strategy_versions ORDER BY id DESC LIMIT 1")
).rows[0];
try {
  for (const row of (
    await db().query(
      "SELECT m.raw,h.book FROM markets m JOIN LATERAL(SELECT book FROM market_price_history WHERE market_id=m.id ORDER BY observed_at DESC LIMIT 1)h ON true ORDER BY m.updated_at DESC",
    )
  ).rows) {
    const m = row.raw,
      b = row.book;
    if (!screen(m, b, strategySchema.parse(version.config)).eligible) continue;
    console.log("Researching:", m.question);
    await job(
      db(),
      "research",
      "started",
      { purpose: "Live integration verification" },
      m.id,
    );
    const result = await research(m, process.env.RESUME_RESERVATION_ID);
    const id = await persistResearch(m.id, version.id, result);
    await job(db(), "research", "completed", { researchId: id }, m.id);
    const fresh = await book(m.slug);
    const decision = await transaction((q) =>
      executePaper(q, String(id), m, fresh),
    );
    console.log(
      JSON.stringify(
        {
          researchId: id,
          probability: result.probability,
          confidence: result.confidence,
          analysts: result.analysts.length,
          sources: result.analysts.reduce(
            (n, a) => n + a.analysis.sources.length,
            0,
          ),
          decision,
        },
        null,
        2,
      ),
    );
    process.exit(0);
  }
  throw Error("No eligible market found");
} catch (e) {
  const message = e instanceof Error ? e.message : "Unknown";
  await job(db(), "research", "failed", { message });
  console.error(message);
  process.exit(1);
}
