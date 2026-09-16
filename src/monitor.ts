import Decimal from "decimal.js";
import { runActive } from "./run-window";
import { type DB, audit } from "./db";
import { type Market, type Book } from "./polymarket";
import { strategySchema } from "./config";
import { saveBook } from "./engine";
/** Exit only with a fresh thesis and enough observed bids to close the complete position. */
export async function reviewPosition(
  q: DB,
  positionId: string,
  m: Market,
  b: Book,
  execute = false,
) {
  await q.query("SELECT id FROM portfolio WHERE id=1 FOR UPDATE");
  const p = (
    await q.query(
      "SELECT p.*,o.decision FROM positions p JOIN simulated_orders o ON o.id=p.order_id WHERE p.id=$1 AND p.closed_at IS NULL FOR UPDATE OF p",
      [positionId],
    )
  ).rows[0];
  if (!p) return;
  if (p.market_id !== m.id || b.slug !== m.slug) throw Error("Exit book does not match position");
  const run = (
    await q.query(
      "SELECT * FROM research_runs WHERE market_id=$1 ORDER BY created_at DESC LIMIT 1",
      [m.id],
    )
  ).rows[0];
  const s = strategySchema.parse(
    (
      await q.query(
        "SELECT config FROM strategy_versions ORDER BY id DESC LIMIT 1",
      )
    ).rows[0].config,
  );
  const now = Date.now(),
    age = now - b.observedAt.getTime();
  if (
    age < 0 ||
    age > s.maxBookAgeSeconds * 1000 ||
    b.state !== "MARKET_STATE_OPEN"
  )
    return;
  const bookId = await saveBook(q, m.id, b);
  let action = "HOLD",
    reason = "No fresh research justifies an exit";
  const levels =
    p.side === "LONG"
      ? b.bids
      : b.offers.map((l) => ({
          price: new Decimal(1).minus(l.price).toString(),
          quantity: l.quantity,
        }));
  const bid = levels[0]?.price;
  if (
    p.decision?.mode !== "exploratory" && run &&
    now - new Date(run.created_at).getTime() <=
      s.maxResearchAgeHours * 3600000 &&
    new Date(run.created_at).getTime() <= now &&
    bid
  ) {
    const probability =
      p.side === "LONG" ? Number(run.probability) : 1 - Number(run.probability);
    if (run.analysis.unresolvedContradictions) {
      action = "REDUCE";
      reason = "New unresolved evidence; reduction requires review";
    } else if (
      Number(run.quality) >= s.minQuality &&
      probability <= Number(bid) - s.feeBuffer
    ) {
      action = "EXIT";
      reason =
        "Fresh probability estimate is below executable liquidation value";
    }
  }
  if (p.decision?.mode === "exploratory" && bid) {
    const net = new Decimal(p.quantity).mul(bid).minus(new Decimal(p.quantity).mul(s.feeBuffer).toDecimalPlaces(2,Decimal.ROUND_UP));
    const change = net.div(p.cost).minus(1).toNumber();
    const elapsed = now - new Date(p.opened_at).getTime();
    const ending = Date.parse(process.env.RUN_END_AT ?? "") - now <= 15*60000;
    if (elapsed >= 30*60000 || change >= 0.10 || change <= -0.15 || ending) {
      action = "EXIT";
      reason = ending ? "Exploratory run ending" : elapsed >= 30*60000 ? "Exploratory 30-minute holding limit" : change >= 0.10 ? "Exploratory profit target" : "Exploratory loss limit";
    } else reason = "Exploratory baseline: monitor time, profit and loss limits";
  }
  await q.query(
    "INSERT INTO position_updates(position_id,action,reason,research_id,book_id) VALUES($1,$2,$3,$4,$5)",
    [p.id, action, reason, run?.id ?? null, bookId],
  );
  if (action !== "EXIT" || !execute || !runActive()) return { action, reason };
  let remaining = new Decimal(p.quantity),
    proceeds = new Decimal(0),
    fee = new Decimal(0);
  const fills = [];
  for (const level of [...levels].sort(
    (a, b) => Number(b.price) - Number(a.price),
  )) {
    const px = new Decimal(level.price),
      qty = Decimal.min(remaining, new Decimal(level.quantity).floor());
    if (qty.lte(0) || px.lte(s.feeBuffer)) continue;
    const f = qty.mul(s.feeBuffer).toDecimalPlaces(2, Decimal.ROUND_UP);
    proceeds = proceeds.plus(qty.mul(px)).minus(f);
    fee = fee.plus(f);
    fills.push({ price: level.price, quantity: qty.toFixed(0) });
    remaining = remaining.minus(qty);
    if (remaining.isZero()) break;
  }
  if (remaining.gt(0)) {
    await audit(q, "EXIT_UNFILLED", {
      positionId: p.id,
      reason: "Insufficient bid depth for full exit",
    });
    return { action: "HOLD", reason: "Insufficient depth" };
  }
  await q.query(
    "INSERT INTO simulated_exits(position_id,book_id,proceeds,fee,fills,reason) VALUES($1,$2,$3,$4,$5,$6)",
    [
      p.id,
      bookId,
      proceeds.toFixed(6),
      fee.toFixed(6),
      JSON.stringify(fills),
      reason,
    ],
  );
  await q.query(
    "UPDATE positions SET closed_at=clock_timestamp(),payout=$1,realized_pnl=$1-cost WHERE id=$2",
    [proceeds.toFixed(6), p.id],
  );
  await q.query("UPDATE portfolio SET cash=cash+$1 WHERE id=1", [
    proceeds.toFixed(6),
  ]);
  await audit(q, "PAPER_EXIT", {
    positionId: p.id,
    proceeds: proceeds.toFixed(6),
    fee: fee.toFixed(6),
    fills,
    reason,
  });
  return { action: "EXIT", reason };
}
