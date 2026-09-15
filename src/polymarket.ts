import { z } from "zod";
import type { Level } from "./finance";
const marketSchema = z
  .object({
    id: z.string(),
    slug: z.string(),
    question: z.string(),
    description: z.string().default(""),
    category: z.string().default("unknown"),
    endDate: z.string().optional(),
    active: z.boolean(),
    closed: z.boolean(),
    status: z.string().optional(),
    ep3Status: z.string().optional(),
    marketSides: z
      .array(
        z.object({
          id: z.string(),
          description: z.string(),
          long: z.boolean(),
          tradable: z.boolean().optional(),
        }),
      )
      .default([]),
    feeCoefficient: z.number().optional(),
    volume: z.number().optional(),
    minimumTradeQty: z.number().optional(),
  })
  .passthrough();
export type Market = z.infer<typeof marketSchema>;
const price = z.object({
  value: z.union([z.string(), z.number()]),
  currency: z.literal("USD"),
});
const level = z.object({ px: price, qty: z.string() });
const bookSchema = z.object({
  marketData: z
    .object({
      marketSlug: z.string(),
      bids: z.array(level),
      offers: z.array(level),
      state: z.string(),
      transactTime: z.string().optional(),
    })
    .passthrough(),
});
export type Book = {
  slug: string;
  bids: Level[];
  offers: Level[];
  state: string;
  observedAt: Date;
  exchangeAt: string | null;
  raw: unknown;
};
let nextRequestAt = 0;
async function get(path: string) {
  for (let i = 0; i < 3; i++) {
    const wait = Math.max(0, nextRequestAt - Date.now());
    nextRequestAt = Math.max(Date.now(), nextRequestAt) + 250;
    if (wait) await new Promise((r) => setTimeout(r, wait));
    const r = await fetch(`https://gateway.polymarket.us${path}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    if (r.ok) return r.json();
    if ((r.status === 429 || r.status >= 500) && i < 2) {
      const retry = Number(r.headers.get("retry-after"));
      await new Promise((r) =>
        setTimeout(
          r,
          Math.max(
            1000 * 2 ** i,
            Math.min(30000, (Number.isFinite(retry) ? retry : 0) * 1000),
          ),
        ),
      );
      continue;
    }
    throw Error(`Polymarket US HTTP ${r.status}`);
  }
  throw Error("Polymarket unavailable");
}
export async function listMarkets(limit = 100, offset = 0) {
  const data = await get(
    `/v1/markets?active=true&closed=false&limit=${limit}&offset=${offset}`,
  );
  return z.array(marketSchema).parse(data.markets);
}
export async function upcomingGames() {
  const markets: Market[] = [];
  for (const sport of ["tennis", "soccer", "baseball", "basketball"]) {
    try {
      const data = await get(`/v2/sports/${sport}/events?limit=10&type=sport`);
      for (const event of data.events ?? []) for (const raw of event.markets ?? []) {
        const parsed = marketSchema.safeParse(raw);
        if (parsed.success) markets.push(parsed.data);
      }
    } catch { /* Other sports and the general market feed remain available. */ }
  }
  return markets;
}
/** Scheduled game time ranks short horizons; contractual endDate remains unchanged. */
export function opportunityTime(m: Market) {
  const game = typeof m.gameStartTime === "string" ? Date.parse(m.gameStartTime) : NaN;
  if (m.marketType !== "futures" && Number.isFinite(game) && game > Date.now() - 4 * 3600000) return game;
  return Date.parse(m.endDate ?? "") || Infinity;
}
export async function marketBySlug(slug: string) {
  const data = await get(`/v1/market/slug/${encodeURIComponent(slug)}`);
  return marketSchema.parse(data.market ?? data);
}
export async function book(slug: string): Promise<Book> {
  const raw = await get(`/v1/markets/${encodeURIComponent(slug)}/book`),
    parsed = bookSchema.parse(raw).marketData;
  if (parsed.marketSlug !== slug)
    throw Error("Provider returned a different market book");
  const map = (levels: z.infer<typeof level>[]) =>
    levels.map((l) => {
      const p = Number(l.px.value),
        q = Number(l.qty);
      if (!Number.isFinite(p) || p < 0 || p > 1 || !Number.isFinite(q) || q < 0)
        throw Error("Invalid order book");
      return { price: String(l.px.value), quantity: l.qty };
    });
  return {
    slug: parsed.marketSlug,
    bids: map(parsed.bids).sort((a, b) => Number(b.price) - Number(a.price)),
    offers: map(parsed.offers).sort(
      (a, b) => Number(a.price) - Number(b.price),
    ),
    state: parsed.state,
    observedAt: new Date(),
    exchangeAt: parsed.transactTime ?? null,
    raw,
  };
}
export async function settlement(slug: string) {
  const data = await get(`/v1/markets/${encodeURIComponent(slug)}/settlement`);
  return z
    .object({ slug: z.string(), settlement: z.number().min(0).max(1) })
    .parse(data);
}
export function isOpen(m: Market) {
  return (
    m.active &&
    !m.closed &&
    m.status === "MARKET_STATUS_OPEN" &&
    m.marketSides.length === 2 &&
    m.marketSides.some((s) => s.long) &&
    m.marketSides.some((s) => !s.long)
  );
}
