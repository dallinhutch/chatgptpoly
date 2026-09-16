# Exploratory paper trading

The user authorized a new eight-hour paper run, a $10 API cap, and a target of at least 15 filled entries. Exits are counted separately. No real orders are sent.

This baseline buys the quoted favorite in live Polymarket US moneyline markets with explicit settlement descriptions and game times in the near-term window. It does not claim an independently estimated probability or positive expected return. Orders have nullable research IDs and are explicitly labeled exploratory. AI recommendations retain their existing evidence and return filters.

Limits: $5 maximum per entry including conservative fees; $20 total open cost; at most four open positions; $15 per category; $100 total exploratory entry cost per run; at least ten minutes between entries; one exploratory entry per market per run; pause new exploratory entries below $990 marked equity. These limits and market availability may prevent the target.

Entries require two-sided live books, spread no more than three cents, favorite ask between 55 and 85 cents, matching market/quote IDs, and current quotes. Simulated buys consume actual quoted whole-share depth. No new exploratory entries in the final 45 minutes.

Attempt full exits after 30 minutes, 10% profit or 15% loss at the best available quote after the fee reserve, or in the final 15 minutes of the run. Exit fills consume full observed depth and include fees; insufficient depth leaves the position open and records the failure. Thresholds are triggers, not guaranteed execution prices. Official settlement continues to account for unresolved positions; discretionary trading stops at the deadline.

API reservations remain conservative: $2 per three-analyst batch, up to five batches for this run. Reservation exhaustion pauses AI research but does not stop the exploratory strategy. No paid call is required for an exploratory buy or exit. Reservations are not actual billed costs.

Validation: database integration checks cover no fabricated research, cash conservation, replay protection, cooldown, stale/mismatched books, unavailable exit depth, completed exit P&L, and the run deadline. Existing tests cover ordinary research entries, settlements, audit immutability, and API budget caps.
