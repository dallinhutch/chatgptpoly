import { listMarkets, book, isOpen } from "../src/polymarket";
const markets = await listMarkets(5);
const market = markets.find(isOpen);
if (!market) throw Error("No open binary market returned");
const b = await book(market.slug);
console.log(
  JSON.stringify(
    {
      provider: "Polymarket US",
      checkedAt: new Date().toISOString(),
      marketsReturned: markets.length,
      market: market.question,
      slug: market.slug,
      state: b.state,
      bids: b.bids.length,
      offers: b.offers.length,
      observedAt: b.observedAt,
      exchangeAt: b.exchangeAt,
    },
    null,
    2,
  ),
);
