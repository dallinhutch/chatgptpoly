import type { DB } from "./db";
import type { Market } from "./polymarket";
export const strictRun = () => process.env.STRICT_PAPER_RUN === "true";
export function strictMarket(m: Market, now=Date.now()) {
  const game=Date.parse(String(m.gameStartTime ?? ""));
  return m.marketType === "moneyline" && Number.isFinite(game) && game >= now-3*3600000 && game <= Math.min(Date.parse(process.env.RUN_END_AT ?? ""),now+8*3600000);
}
export async function strictEntryStatus(q: DB, marketId?:string, now=Date.now()) {
  if (!strictRun()) return null;
  const start=process.env.RUN_START_AT, end=Date.parse(process.env.RUN_END_AT ?? "");
  const target=Number(process.env.RUN_TRADE_TARGET), initial=Number(process.env.RUN_START_EQUITY);
  if (!start || !Number.isFinite(end) || !Number.isInteger(target) || target<1 || target>20 || !Number.isFinite(initial) || initial<=0) return "Invalid strict run limits";
  if (now>=end-75*60000) return "Entry window closed";
  const rows=(await q.query("SELECT market_id FROM positions WHERE opened_at >= $1",[start])).rows;
  if (rows.length>=target) return "Trade target reached";
  if (marketId && rows.some(r=>r.market_id===marketId)) return "Market already traded this run";
  const account=(await q.query("SELECT cash FROM portfolio WHERE id=1")).rows[0];
  const open=(await q.query("SELECT cost FROM positions WHERE closed_at IS NULL")).rows;
  const latest=(await q.query("SELECT equity,stale_marks FROM portfolio_snapshots ORDER BY id DESC LIMIT 1")).rows[0];
  if(open.length && (!latest || latest.stale_marks)) return "Portfolio marks unavailable";
  if(Number(open.length ? latest.equity : account.cash) <= initial-20) return "Run loss limit reached";
  if(open.length>=4 || open.reduce((n,p)=>n+Number(p.cost),0)>=100) return "Open exposure limit reached";
  return null;
}
