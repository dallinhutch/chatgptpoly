import { transaction, audit } from "./db";
import type { research } from "./research";
export async function persistResearch(
  marketId: string,
  strategyId: string,
  result: Awaited<ReturnType<typeof research>>,
) {
  return transaction(async (q) => {
    const run = (
      await q.query(
        "INSERT INTO research_runs(market_id,strategy_id,analysis,probability,confidence,quality,disagreement) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id",
        [
          marketId,
          strategyId,
          JSON.stringify(result),
          result.probability,
          result.confidence,
          result.quality,
          result.disagreement,
        ],
      )
    ).rows[0];
    for (const a of result.analysts) {
      await q.query(
        "INSERT INTO analyst_predictions(research_id,analyst,model,prediction) VALUES($1,$2,$3,$4)",
        [run.id, a.perspective, a.model, JSON.stringify(a)],
      );
      for (const s of a.analysis.sources)
        await q.query(
          "INSERT INTO research_sources(research_id,url,title,evidence) VALUES($1,$2,$3,$4)",
          [run.id, s.url, s.title, JSON.stringify(s)],
        );
    }
    await audit(q, "RESEARCH_COMPLETED", {
      researchId: run.id,
      marketId,
      ...result,
    });
    return run.id;
  });
}
