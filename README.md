# PolyLab

A private Polymarket **US** research and paper-trading laboratory. Initial simulated cash is exactly **$1,000.00**. No exchange order-submission endpoint, wallet, funding operation, or real-money execution adapter exists in this project.

## Status

The initial live application is at **https://paycheckadvisor.com**, behind a private login. Live US listings/books and a three-prompt research run have been tested. The first research decision was NO TRADE. The application includes authentication, PostgreSQL migrations, screening, source validation, conservative simulated execution, settlement, position review, strategy versioning, audit export, and a dashboard. See [VALIDATION.md](VALIDATION.md) for actual checks and remaining limitations. This is not a claim of proven forecasting performance or long-term production reliability.

The original Paycheck Advisor WordPress files and prefixed database tables were removed at the owner's explicit request. Other hosted domains were not changed. The host provides Node 24 outside PATH. The deployed compatibility setup uses its existing HTTPS hosting, a small PHP reverse proxy, a private Node supervisor, and a user-owned PostgreSQL 18.4 process. The separate VPS connection is still unspecified; the Docker path remains available for migration.

## Architecture

```
Polymarket US public GET endpoints → worker → PostgreSQL
                                          ↑      ↓
OpenAI Responses + web search → research → risk gates → paper ledger
                                                 ↓
Browser → HTTPS / Caddy → authenticated Next.js dashboard
```

- Next.js + TypeScript for the private dashboard and server-side routes.
- PostgreSQL for persistence (17 in Compose, 18.4 on the current host); migrations run as owner, runtime uses a restricted role.
- A Node worker owns a PostgreSQL advisory lock so only one worker scans/researches.
- Decimal arithmetic for cash, fills, sizing, and settlement. Display analytics use floating point; accounting does not.
- Docker Compose runs PostgreSQL, migrations, role provisioning, web, worker, and Caddy HTTPS.
- Local development can use PGlite (embedded PostgreSQL) in **one process at a time**. It is rejected in production.

## Local setup

Use Node 24. Install with `npm ci`. Copy `.env.example` to `.env.local` and configure it. Never commit this file. CLI commands below use `--env-file=.env.local`; Next.js loads it automatically.

For a local, single-process preview set `LOCAL_DATABASE_PATH=./data/preview` and `APP_ORIGIN=http://127.0.0.1:3000`. Generate an administrator password hash with `npm run password`, feeding a 16+ character password through stdin. Generate `SESSION_SECRET` using a cryptographically random generator (at least 32 characters).

```
node --env-file=.env.local --import tsx scripts/local-seed.ts
npm run dev
```

`local-seed` migrates and reads a bounded sample of real markets. It inserts no fake predictions or trades. Stop the development server before running another CLI against the embedded database. It is not a continuous local worker. For continuous scanning use PostgreSQL and the worker.

```
npm test
npm run typecheck
npm run build
npm run live-check
```

## Research and cost controls

`OPENAI_API_KEY` stays server-side. `OPENAI_MODEL=gpt-5-mini` is the only enabled model until another model's cost bounds are reviewed. `RESEARCH_ENABLED=true` permits research; `PAPER_TRADING_ENABLED=true` separately permits scheduled paper execution. Both default off in the example configuration.

Each research run reserves $1 from an append-only budget before requesting analysis. Defaults reserve at most $1/day and $5 over the life of this database. Reservations are not released after failures, and each reservation permits at most three analyst attempts. Each call has at most two tool calls and 4,000 output tokens, with low search context. The reservation is a conservative allowance, **not an exact billing guarantee**: tool input sizes and provider pricing can change. Set a provider-side budget as a second control. Recorded usage is available in analyst response activity. No API credit balance is inferred from the key.

The three prompts independently emphasize base rates, the counter-case, and resolution wording. They use one model and may share sources; they are correlated estimates, not three independent forecasting models. Evidence quality and confidence are model judgments and require calibration. Source URLs must match the search tool's returned URLs after stripping only known tracking parameters. This verifies provenance, not the truth of a source or that every claim is supported. Undated or invalidly dated sources block trading. Confidence and disagreement gates generally reject weak evidence.

## Simulation integrity

- Portfolio row locks make cash changes, fills, positions and audit records atomic.
- Unique idempotency keys reject repeated execution of the same research run.
- Whole-share buys walk observed offer depth. Short entries complement observed long bids. No displayed last price is treated as an executable quote.
- Quotes must be received within the configured age; future observations are rejected.
- A fixed per-share fee reserve is deliberately conservative, **not the exact exchange fee schedule**. It is recorded in each decision. Native minimum quantity is checked; exact exchange order restrictions need further venue validation.
- A partial buy can fill only available shares. Exit execution requires enough bid depth for a complete close. REDUCE is a logged recommendation; partial automated exits are not implemented.
- Fractional Kelly is bounded by cash reserve, position, total, category and correlated exposure, and drawdown limits. The initial correlation group is the entire category, intentionally conservative. ADD is disabled.
- Settlement requires the provider's explicit resolved market status and settlement endpoint, including split/cancel payouts. A terminal-looking price alone is never resolution proof.
- Missing liquidation marks set a stale flag. Such marks are unsuitable for reliable performance interpretation and block new positions.

## Audit and evaluation

Historical predictions, sources, fills, strategies and audit rows reject UPDATE/DELETE. The runtime role has no DELETE, TRUNCATE, or schema ownership rights. A SHA-256 chain links audit event contents. Run `node --env-file=.env.local --import tsx scripts/verify-audit.ts` to verify it. Authenticated `/api/audit?after=0` exports 1,000 rows per page; use `X-Next-Cursor` for the next page.

**An administrator controlling the database can still rewrite history.** To establish external proof, export and anchor audit heads in an independently controlled immutable backup destination. This is not configured yet. Ordinary hashes alone do not provide that guarantee.

Calibration uses the first forecast per market and excludes non-binary payouts, avoiding repeated-forecast overweighting. Confidence is evidence certainty; probability is likelihood of the outcome. They are distinct quantities. Analytics remain descriptive until enough events resolve.

## Deploy to Hostinger VPS

See [deploy/RUNBOOK.md](deploy/RUNBOOK.md) for the VPS path and [deploy/hosting/README.md](deploy/hosting/README.md) for the current host. A widget cannot establish complete API access. Public REST access is rate-limited and does not imply account or WebSocket access.

## Official integration references

- [US market API](https://docs.polymarket.us/api-reference/market/overview)
- [US books](https://docs.polymarket.us/api-reference/markets/get-market-book)
- [US settlement](https://docs.polymarket.us/api-reference/markets/get-market-settlement)
- [US rate limits](https://docs.polymarket.us/api-reference/rate-limits)
- [OpenAI web search](https://developers.openai.com/api/docs/guides/tools-web-search)
- [OpenAI structured output](https://developers.openai.com/api/docs/guides/structured-outputs)
