import { transaction, audit } from "./db";
import { strategySchema } from "./config";
import { runActive } from "./run-window";
/** Explicitly authorized modest relaxation; all other strategy gates remain intact. */
export async function adaptConfidence() {
  if (process.env.STRICT_PAPER_RUN === "true") return;
  if (!process.env.RUN_START_AT || !runActive()) return;
  const elapsed = Date.now() - Date.parse(process.env.RUN_START_AT);
  if (elapsed < 3600000) return;
  await transaction(async q => {
    await q.query("SELECT id FROM portfolio WHERE id=1 FOR UPDATE");
    if ((await q.query("SELECT id FROM positions WHERE opened_at >= $1 LIMIT 1", [process.env.RUN_START_AT])).rows.length) return;
    if (!(await q.query("SELECT id FROM audit_events WHERE kind='NO_TRADE' AND created_at >= $1 AND payload->'reasons' ? 'Research below thresholds' LIMIT 1", [process.env.RUN_START_AT])).rows.length) return;
    const current = (await q.query("SELECT * FROM strategy_versions ORDER BY id DESC LIMIT 1")).rows[0];
    const config = strategySchema.parse(current.config);
    const target = elapsed >= 3 * 3600000 ? 0.70 : 0.75;
    if (config.minConfidence <= target) return;
    const previous = config.minConfidence;
    config.minConfidence = target;
    const next = (await q.query("INSERT INTO strategy_versions(config) VALUES($1) RETURNING id", [JSON.stringify(config)])).rows[0];
    await audit(q, "STRATEGY_CHANGED", {id: next.id, previousConfidence: previous, config, reason: "User-authorized timed-run adaptation after no fills and rejected research; confidence floor 70%, other gates retained"});
  });
}
