# Research-backed paper run

The September 18 request authorizes another 20 paper trades with greater confidence. Eight-hour window; existing $10 API cap retained. Starting cash and timestamps are recorded in the immutable audit trail. Do not reset the historical ledger or extend the window automatically.

- Exploratory buying disabled; confidence adaptation disabled.
- Minimum estimated outcome probability 80%, evidence confidence 85%, quality 85%, disagreement at most 8 percentage points. Estimates are not calibrated guarantees.
- Three source-grounded analyst prompts, dated evidence, clear rules, and net entry edge at least 6 percentage points after the entry fee reserve. Sports moneylines within the short-term window only.
- At most 20 entries, one per market per run; $25 per entry, $100 open, $75 category/correlated, four open positions. Stop new entries at $20 run drawdown. These limits cannot guarantee maximum realized loss during gaps.
- Independent five-second monitoring loop, plus network latency. Exit on net +/-10%, 60-minute holding time, or final 15 minutes. Live executable depth required. Entry cutoff 75 minutes before run end. No false fills when liquidity is unavailable.
- Reserve $2 before each three-response research batch. Unknown/failed batches retain the reservation. Only three distinct completed responses with valid usage can be accounted at double the uncached-rate estimate, rounded up to cents. Sources: https://developers.openai.com/api/docs/models/gpt-5-mini and https://developers.openai.com/api/docs/pricing (checked September 18). Original reservation rows remain immutable. Report estimated usage separately from reservations and invoices.
- Precompiled runtime entrypoints avoid tsx worker-thread address-space reservations during PHP-triggered recovery. The hosting plan can still terminate processes; report outages honestly.

Report each actual entry/exit, entry-time probability and confidence, paper size, fees, realized return, total P&L and any open positions directly in the user's conversation. Report a shortfall instead of fabricating or forcing trades.
