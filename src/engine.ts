import Decimal from "decimal.js";
import { recommendationMetrics } from "./recommendation";
import { assertRunActive } from "./run-window";
import { strategySchema, type Strategy } from "./config";
import { type DB, audit } from "./db";
import {
  book,
  isOpen,
  listMarkets,
  upcomingGames,
  opportunityTime,
  type Market,
  type Book,
} from "./polymarket";
import { sizePosition, simulateBuy, settle, total } from "./finance";

export async function saveMarket(q: DB, m: Market) {
  await q.query(
    "INSERT INTO markets(id,slug,question,category,rules,end_date,raw) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO UPDATE SET question=EXCLUDED.question,category=EXCLUDED.category,rules=EXCLUDED.rules,end_date=EXCLUDED.end_date,raw=EXCLUDED.raw,updated_at=clock_timestamp()",
    [
      m.id,
      m.slug,
      m.question,
      m.category,
      m.description,
      m.endDate ?? null,
      JSON.stringify(m),
    ],
  );
}
export async function saveBook(q: DB, marketId: string, b: Book) {
  return (
    await q.query(
      "INSERT INTO market_price_history(market_id,observed_at,exchange_at,book) VALUES($1,$2,$3,$4) RETURNING id",
      [marketId, b.observedAt, b.exchangeAt, JSON.stringify(b)],
    )
  ).rows[0].id;
}
export function screen(m: Market, b: Book, s: Strategy) {
  const reasons: string[] = [];
  if (!isOpen(m) || b.state !== "MARKET_STATE_OPEN")
    reasons.push("Market is not open and binary");
  if (!m.description.trim()) reasons.push("Missing resolution rules");
  if (
    !m.endDate ||
    !Number.isFinite(Date.parse(m.endDate)) ||
    Date.parse(m.endDate) - Date.now() < s.minHoursRemaining * 3600000
  )
    reasons.push("Insufficient time remaining");
  if (!b.bids.length || !b.offers.length)
    reasons.push("Two-sided liquidity required");
  const spread =
    Number(b.offers[0]?.price ?? 1) - Number(b.bids[0]?.price ?? 0);
  if (spread < 0 || spread > s.maxSpread) reasons.push("Spread outside limits");
  const depth = b.offers
    .filter(
      (l) => Number(l.price) <= Number(b.offers[0]?.price ?? 0) + s.maxSpread,
    )
    .reduce((v, l) => v + Number(l.price) * Number(l.quantity), 0);
  if (depth < s.minLiquidity)
    reasons.push("Insufficient nearby offer liquidity");
  return {
    eligible: reasons.length === 0,
    reasons,
    depth,
    score: reasons.length ? 0 : Math.log1p(depth) / (1 + spread * 100),
  };
}
export async function scan(q: DB, maxMarkets = 1000) {
  const s = strategySchema.parse(
    (
      await q.query(
        "SELECT config FROM strategy_versions ORDER BY id DESC LIMIT 1",
      )
    ).rows[0].config,
  );
  const seen = new Set<string>();
  let count = 0;
  const candidates = [];
  const open: Market[] = [];
  await job(q, "scan", "started", { marketLimit: maxMarkets });
  if (process.env.PREFER_SHORT_TERM === "true") {
    for (const m of await upcomingGames()) {
      if (seen.has(m.id)) continue;
      seen.add(m.id);
      await saveMarket(q, m);
      count++;
      if (isOpen(m)) open.push(m);
    }
  }
  for (let offset = 0; offset < maxMarkets; offset += 100) {
    const page = await listMarkets(Math.min(100, maxMarkets - offset), offset);
    let added = 0;
    for (const m of page) {
      if (seen.has(m.id)) continue;
      seen.add(m.id);
      added++;
      await saveMarket(q, m);
      count++;
      if (isOpen(m) && (!process.env.PREFER_SHORT_TERM || (Date.parse(m.endDate ?? "") - Date.now() >= s.minHoursRemaining * 3600000))) open.push(m);
    }
    if (page.length < 100 || !added) break;
  }
  const observed = new Map(
    (
      await q.query(
        "SELECT market_id,MAX(observed_at) AS at FROM market_price_history GROUP BY market_id",
      )
    ).rows.map((r) => [r.market_id, new Date(r.at).getTime()]),
  );
  // Rotate through the least recently observed books; bounded work keeps research and monitoring responsive.
  open.sort(
    (a, b) =>
      (observed.get(a.id) ?? 0) - (observed.get(b.id) ?? 0) ||
      Number(b.volume ?? 0) - Number(a.volume ?? 0),
  );
  if (process.env.PREFER_SHORT_TERM === "true") {
    open.sort((a, b) => opportunityTime(a) - opportunityTime(b));
  }
  if (process.env.EXPLORATORY_PAPER_ENABLED === "true") {
    const near = (m: Market) => m.marketType === "moneyline" && typeof m.gameStartTime === "string" && Date.parse(m.gameStartTime) >= Date.now()-3*3600000 && Date.parse(m.gameStartTime) <= Date.now()+8*3600000;
    open.sort((a,b)=>Number(near(b))-Number(near(a)) || (observed.get(a.id) ?? 0)-(observed.get(b.id) ?? 0) || opportunityTime(a)-opportunityTime(b));
  }
  const bookLimit = Math.max(
    1,
    Math.min(100, Number(process.env.BOOKS_PER_SCAN ?? 30)),
  );
  for (const m of open.slice(0, bookLimit)) {
    try {
      const b = await book(m.slug);
      await saveBook(q, m.id, b);
      candidates.push({ market: m, ...screen(m, b, s) });
    } catch (e) {
      await job(
        q,
        "book",
        "failed",
        { message: e instanceof Error ? e.message : "Unknown" },
        m.id,
      );
    }
  }
  await job(q, "scan", "completed", {
    markets: count,
    books: candidates.length,
    eligible: candidates.filter((c) => c.eligible).length,
    coverage: `Up to ${maxMarkets} markets discovered; ${bookLimit} books rotated per cycle`,
  });
  return candidates.sort((a, b) => process.env.PREFER_SHORT_TERM === "true"
    ? opportunityTime(a.market) - opportunityTime(b.market) || b.score - a.score
    : b.score - a.score);
}
export async function job(
  q: DB,
  kind: string,
  status: string,
  detail: unknown,
  marketId: string | null = null,
) {
  await q.query(
    "INSERT INTO system_jobs(kind,status,detail,market_id) VALUES($1,$2,$3,$4)",
    [kind, status, JSON.stringify(detail), marketId],
  );
}

export async function executePaper(
  q: DB,
  researchId: string,
  m: Market,
  b: Book,
  now = new Date(),
  recommendOnly = false,
) {
  assertRunActive();
  if (b.slug !== m.slug) throw Error("Order book does not match market");
  const account = (
    await q.query("SELECT * FROM portfolio WHERE id=1 FOR UPDATE")
  ).rows[0];
  const run = (
    await q.query("SELECT * FROM research_runs WHERE id=$1", [researchId])
  ).rows[0];
  if (!run || run.market_id !== m.id)
    throw Error("Research does not match market");
  const version = (
      await q.query("SELECT * FROM strategy_versions ORDER BY id DESC LIMIT 1")
    ).rows[0],
    s = strategySchema.parse(version.config);
  const key = `entry:${researchId}`;
  if (
    (
      await q.query(
        "SELECT id FROM simulated_orders WHERE idempotency_key=$1",
        [key],
      )
    ).rows.length
  )
    return { status: "duplicate" };
  const reasons = screen(m, b, s).reasons;
  if (
    run.analysis.marketSnapshot &&
    run.analysis.marketSnapshot.description !== m.description
  )
    reasons.push("Resolution rules changed after research");
  if (String(run.strategy_id) !== String(version.id))
    reasons.push("Strategy changed after research");
  const age = now.getTime() - new Date(run.created_at).getTime();
  if (age < 0 || age > s.maxResearchAgeHours * 3600000)
    reasons.push("Research expired");
  if (
    Number(run.confidence) < s.minConfidence ||
    Number(run.quality) < s.minQuality ||
    Number(run.disagreement) > s.maxDisagreement
  )
    reasons.push("Research below thresholds");
  if (!run.analysis.clearRules || run.analysis.unresolvedContradictions)
    reasons.push("Unresolved evidence or rules");
  const sources =
    run.analysis.analysts?.flatMap((a: any) => a.analysis.sources) ?? [];
  if (
    sources.length < 3 ||
    sources.some(
      (x: any) =>
        !x.publishedAt ||
        !Number.isFinite(Date.parse(x.publishedAt)) ||
        Date.parse(x.publishedAt) > now.getTime(),
    )
  )
    reasons.push("Dated source evidence missing or invalid");
  const positions = (
    await q.query("SELECT * FROM positions WHERE closed_at IS NULL")
  ).rows;
  if (positions.some((p) => p.market_id === m.id))
    reasons.push("Existing position; adding disabled");
  // Conservative correlation grouping: the entire category shares a group until reviewed taxonomy exists.
  const exposure = total(positions.map((p) => p.cost)),
    category = total(
      positions.filter((p) => p.category === m.category).map((p) => p.cost),
    );
  const last = (
    await q.query(
      "SELECT equity,stale_marks FROM portfolio_snapshots ORDER BY id DESC LIMIT 1",
    )
  ).rows[0];
  if (positions.length && (!last || last.stale_marks))
    reasons.push("Portfolio marks unavailable");
  const equity = last?.equity ?? account.cash;
  const peak =
    (await q.query("SELECT MAX(equity) AS peak FROM portfolio_snapshots"))
      .rows[0]?.peak ?? "1000";
  const drawdown = Decimal.max(
    0,
    new Decimal(1).minus(new Decimal(equity).div(Decimal.max(1000, peak))),
  ).toNumber();
  const longPrice = b.offers[0]?.price ?? "1";
  const shortLevels = b.bids.map((l) => ({
    price: new Decimal(1).minus(l.price).toFixed(6),
    quantity: l.quantity,
  }));
  const shortPrice = shortLevels[0]?.price ?? "1";
  const longEdge = Number(run.probability) - Number(longPrice) - s.feeBuffer,
    shortEdge = 1 - Number(run.probability) - Number(shortPrice) - s.feeBuffer;
  const side = longEdge >= shortEdge ? "LONG" : "SHORT",
    price = side === "LONG" ? longPrice : shortPrice,
    p = side === "LONG" ? Number(run.probability) : 1 - Number(run.probability),
    edge = Math.max(longEdge, shortEdge);
  if (edge < s.minEdge) reasons.push("Net edge below threshold");
  const budget = sizePosition(
    {
      probability: p,
      price,
      confidence: Number(run.confidence),
      equity,
      cash: account.cash,
      exposure,
      categoryExposure: category,
      correlatedExposure: category,
      drawdown,
    },
    s,
  );
  if (new Decimal(budget).lte(0)) reasons.push("Risk budget exhausted");
  if (reasons.length) {
    await audit(q, "NO_TRADE", {
      researchId,
      marketId: m.id,
      reasons,
      at: now.toISOString(),
    });
    return { status: "rejected", reasons };
  }
  const limit = Decimal.min(
    new Decimal(p).minus(s.minEdge).minus(s.feeBuffer),
    new Decimal(price).plus(s.maxSpread),
  ).toFixed(6);
  const result = simulateBuy(
    side === "LONG" ? b.offers : shortLevels,
    budget,
    limit,
    s.feeBuffer,
    b.observedAt,
    now,
    s.maxBookAgeSeconds,
  );
  if (
    Number(result.quantity) < (m.minimumTradeQty ?? 1) ||
    result.fills.length === 0
  ) {
    await audit(q, "NO_TRADE", {
      researchId,
      reason: "No executable depth / minimum quantity",
    });
    return { status: "unfilled" };
  }
  if (recommendOnly) {
    const metrics = recommendationMetrics(p, Number(run.confidence), Number(result.spent), Number(result.quantity));
    if (!metrics || !["moneyline", "futures"].includes(String(m.marketType))) return { status: "not_recommended" };
    const prior = await q.query("SELECT id FROM audit_events WHERE kind='RECOMMENDATION_CREATED' AND payload->>'researchId'=$1 LIMIT 1", [researchId]);
    if (prior.rows.length) return { status: "duplicate" };
    const outcome = m.marketSides.find(x => x.long === (side === "LONG"));
    await audit(q, "RECOMMENDATION_CREATED", {
      researchId, marketId: m.id, question: m.question, outcome: outcome?.description ?? side, side,
      recommendedAt: now.toISOString(), quoteAt: b.observedAt.toISOString(), expiresAt: new Date(now.getTime() + 5 * 60000).toISOString(),
      entryPrice: Number(total(result.fills.map(f => f.notional))) / Number(result.quantity),
      feeReserve: total(result.fills.map(f => f.fee)), ...metrics,
      strategyId: version.id, note: "Paper allocation; returns include a conservative fee reserve. Estimates are not guarantees.",
    });
    return { status: "recommended" };
  }
  const bookId = await saveBook(q, m.id, b),
    decision = {
      edge,
      probability: p,
      budget,
      limit,
      feeModel:
        "Conservative fixed fee reserve per share, not exact exchange fees",
      strategy: s,
      market: m,
      at: now.toISOString(),
    };
  const order = (
    await q.query(
      "INSERT INTO simulated_orders(idempotency_key,market_id,research_id,strategy_id,book_id,side,decision) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id",
      [
        key,
        m.id,
        researchId,
        version.id,
        bookId,
        side,
        JSON.stringify(decision),
      ],
    )
  ).rows[0];
  for (const f of result.fills)
    await q.query(
      "INSERT INTO simulated_fills(order_id,price,quantity,notional,fee) VALUES($1,$2,$3,$4,$5)",
      [order.id, f.price, f.quantity, f.notional, f.fee],
    );
  await q.query("UPDATE portfolio SET cash=cash-$1 WHERE id=1", [result.spent]);
  await q.query(
    "INSERT INTO positions(order_id,market_id,category,correlation_group,side,quantity,cost) VALUES($1,$2,$3,$3,$4,$5,$6)",
    [order.id, m.id, m.category, side, result.quantity, result.spent],
  );
  await audit(q, "PAPER_ENTRY", {
    orderId: order.id,
    researchId,
    decision,
    ...result,
  });
  return { status: "filled", ...result };
}
export async function resolvePosition(
  q: DB,
  marketId: string,
  payout: string,
  evidence: unknown,
) {
  await q.query("SELECT id FROM portfolio WHERE id=1 FOR UPDATE");
  if (
    (
      await q.query(
        "SELECT market_id FROM market_resolutions WHERE market_id=$1",
        [marketId],
      )
    ).rows.length
  )
    return;
  await q.query(
    "INSERT INTO market_resolutions(market_id,payout,evidence) VALUES($1,$2,$3)",
    [marketId, payout, JSON.stringify(evidence)],
  );
  for (const p of (
    await q.query(
      "SELECT * FROM positions WHERE market_id=$1 AND closed_at IS NULL FOR UPDATE",
      [marketId],
    )
  ).rows) {
    const value =
        p.side === "LONG" ? payout : new Decimal(1).minus(payout).toFixed(6),
      result = settle(p.quantity, p.cost, value);
    await q.query(
      "UPDATE positions SET closed_at=clock_timestamp(),payout=$1,realized_pnl=$2 WHERE id=$3",
      [result.proceeds, result.pnl, p.id],
    );
    await q.query("UPDATE portfolio SET cash=cash+$1 WHERE id=1", [
      result.proceeds,
    ]);
    await audit(q, "SETTLEMENT", {
      positionId: p.id,
      marketId,
      payout: value,
      ...result,
    });
  }
}
export async function snapshot(q: DB) {
  const account = (
    await q.query("SELECT cash FROM portfolio WHERE id=1 FOR UPDATE")
  ).rows[0];
  let value = new Decimal(0),
    stale = false;
  for (const p of (
    await q.query("SELECT * FROM positions WHERE closed_at IS NULL")
  ).rows) {
    const h = (
      await q.query(
        "SELECT * FROM market_price_history WHERE market_id=$1 ORDER BY observed_at DESC LIMIT 1",
        [p.market_id],
      )
    ).rows[0];
    if (!h || Date.now() - new Date(h.observed_at).getTime() > 120000) {
      stale = true;
      continue;
    }
    const b = h.book;
    const mark =
      p.side === "LONG"
        ? b.bids[0]?.price
        : b.offers[0]
          ? new Decimal(1).minus(b.offers[0].price).toString()
          : null;
    if (mark === null || mark === undefined) {
      stale = true;
      continue;
    }
    value = value.plus(new Decimal(p.quantity).mul(mark));
  }
  await q.query(
    "INSERT INTO portfolio_snapshots(cash,equity,open_value,stale_marks) VALUES($1,$2,$3,$4)",
    [
      account.cash,
      value.plus(account.cash).toFixed(6),
      value.toFixed(6),
      stale,
    ],
  );
}
