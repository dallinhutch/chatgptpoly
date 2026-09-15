import { db } from "./db";
import { runActive } from "./run-window";
export async function dashboard() {
  const q = db();
  const [
    account,
    markets,
    positions,
    history,
    research,
    activity,
    strategies,
    snapshots,
    calibration,
    recommendations,
  ] = await Promise.all([
    q.query(
      "SELECT *, (SELECT MAX(observed_at) FROM market_price_history) AS last_quote FROM portfolio WHERE id=1",
    ),
    q.query(
      "SELECT m.*,h.book,h.observed_at,r.probability,r.confidence,r.quality,r.id AS research_id FROM markets m LEFT JOIN LATERAL(SELECT book,observed_at FROM market_price_history WHERE market_id=m.id ORDER BY observed_at DESC LIMIT 1)h ON true LEFT JOIN LATERAL(SELECT * FROM research_runs WHERE market_id=m.id ORDER BY created_at DESC LIMIT 1)r ON true ORDER BY m.updated_at DESC LIMIT 100",
    ),
    q.query(
      "SELECT p.*,m.question FROM positions p JOIN markets m ON m.id=p.market_id ORDER BY opened_at DESC",
    ),
    q.query(
      "SELECT o.*,m.question,r.probability,r.confidence FROM simulated_orders o JOIN markets m ON m.id=o.market_id JOIN research_runs r ON r.id=o.research_id ORDER BY o.created_at DESC LIMIT 200",
    ),
    q.query(
      "SELECT r.*,m.question FROM research_runs r JOIN markets m ON m.id=r.market_id ORDER BY r.created_at DESC LIMIT 100",
    ),
    q.query(
      "SELECT id,kind,status,created_at,detail-'output' AS detail FROM system_jobs ORDER BY created_at DESC LIMIT 50",
    ),
    q.query("SELECT * FROM strategy_versions ORDER BY id DESC LIMIT 20"),
    q.query(
      "SELECT * FROM (SELECT * FROM portfolio_snapshots ORDER BY id DESC LIMIT 1000)s ORDER BY id",
    ),
    q.query(
      "SELECT r.probability,m.payout,m.market_id,r.strategy_id FROM research_runs r JOIN market_resolutions m ON m.market_id=r.market_id WHERE m.payout IN (0,1) AND r.id=(SELECT MIN(r2.id) FROM research_runs r2 WHERE r2.market_id=r.market_id)",
    ),
    q.query("SELECT id,created_at,payload FROM audit_events WHERE kind='RECOMMENDATION_CREATED' ORDER BY id DESC LIMIT 50"),
  ]);
  return JSON.parse(
    JSON.stringify({
      account: account.rows[0],
      markets: markets.rows,
      positions: positions.rows,
      history: history.rows,
      research: research.rows,
      activity: activity.rows,
      strategies: strategies.rows,
      snapshots: snapshots.rows,
      calibration: calibration.rows,
      recommendations: recommendations.rows,
      checkedAt: new Date().toISOString(),
      runActive: runActive(),
      researchConfigured:
        !!process.env.OPENAI_API_KEY && process.env.RESEARCH_ENABLED === "true",
      tradingEnabled: process.env.PAPER_TRADING_ENABLED === "true",
      local: !!process.env.LOCAL_DATABASE_PATH,
    }),
  );
}
