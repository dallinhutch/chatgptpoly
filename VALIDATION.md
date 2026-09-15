# Validation — 2026-09-15

## Completed

- Inspected local environment and all hosted site identities.
- Verified live Polymarket US market-list and order-book HTTP 200 responses from the Windows machine and hosting account. Observed HTTP 429 responses as well; added throttling and backoff.
- Stored actual market metadata, rules, outcome names, received timestamps and books.
- Used the supplied OpenAI key for three gpt-5-mini Responses calls with web search, under one $1 reservation. Recorded all original outputs and token usage. Fixed tracking-parameter source matching and handling of non-URL tool citations; unsupported evidence reduces quality and blocks trading.
- Stored one aggregate forecast: long probability approximately 6.37%, confidence approximately 43.35%, three prompts and 15 retained URL citations. The decision was NO TRADE, including low confidence/quality, source-date and edge failures. This is an integration result, not a validated prediction.
- 12 automated tests passed: decimal fills, fees, depth/limits, future/stale quotes, win/loss/split settlement, sizing/risk limits, negative-EV rejection, invalid inputs, aggregation, PostgreSQL migration/rollback/duplicate execution, immutable history, password/session validation, and source canonicalization.
- TypeScript passed. Production build succeeded locally and on Hostinger using Webpack/WASM.
- Started PostgreSQL 18.4 bound to 127.0.0.1 and provisioned a restricted runtime role. Imported the original research/observations without changing the starting bankroll.
- Public HTTPS health returns 200; unauthenticated dashboard redirects to login; retired `/wp-login.php` returns 404.
- Login returns a Secure, HttpOnly, SameSite=Strict cookie. Cross-origin login POST returns 403. Fixed proxy-origin redirect and verified login reaches the public domain in a browser.
- Visually inspected the authenticated live dashboard.
- Removed the old WordPress tables; a second cleanup confirmed zero remaining prefixed tables. Removed retired WordPress files and the temporary archive started before the owner waived backups.

## Still not established

- Statistical predictive edge, profitable performance, live-market simulated entry/exit/settlement after a qualified forecast. Those paths are tested with isolated fixtures, not fabricated live history.
- Full exchange feature coverage, exact venue fees, in-play restrictions, authenticated market WebSockets, or access to every market. Scanner discovery is bounded to 1,000 markets per cycle.
- Multi-provider forecast independence, independently verified evidence quality, automatic partial exits, or sophisticated cross-category correlation models.
- VPS deployment, host-boot autostart, long-duration soak testing, external uptime alerts, encrypted backups and external immutable audit anchoring.

The UI shows genuine empty positions/history until a trade qualifies. Research and paper execution are enabled on the host with a one-run/day limit, $1/day reservations and $5 lifetime reservations. Real-money execution is absent.
