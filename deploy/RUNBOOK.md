# Hostinger deployment and replacement

## Required connection details

Identify the exact replacement domain, VPS SSH address/user/port, and DNS control. The shared hosting account has several sites; do not select one based on directory recency. The user's authorization to replace a site applies only after its identity is known.

## Preserve the current site

1. Inspect the chosen `~/domains/<domain>/public_html`, WordPress home/siteurl, plugin list, redirects, TLS and cron configuration.
2. Place a file archive and WP-CLI database export **outside public_html**, in an account-private directory with mode 0700. Record checksums and ensure the SQL export is nonempty.
3. Download backups to secure private storage and test restoration in isolation. Never add WordPress configuration, database exports or keys to Git.
4. Record current DNS answers, TTLs and webserver configuration for rollback.

## VPS preparation

Inspect OS, memory/disk, listening services, reverse proxy and existing Docker applications. Do not replace an existing proxy or firewall wholesale. Compose's Caddy publishes 80/443 only when those ports are available. Otherwise integrate the new container into the existing reverse proxy configuration after backing it up.

1. Clone `https://github.com/dallinhutch/chatgptpoly.git` into a new application directory.
2. Install Docker Engine + Compose following official platform instructions if absent.
3. Copy `.env.example` to `.env`, set mode 0600, and supply secrets through the server environment.
4. Generate `POSTGRES_PASSWORD` and `APP_DATABASE_PASSWORD` as 32 random bytes encoded as 64 hex characters. Use the owner credentials in `DATABASE_URL=postgresql://polylab:<owner-password>@postgres:5432/polylab`. Compose overrides the web/worker URL to use the restricted runtime role.
5. Set the actual `DOMAIN`, HTTPS `APP_ORIGIN`, administrator password hash and random `SESSION_SECRET`. Leave `LOCAL_DATABASE_PATH` unset. Supply the OpenAI key only in the secret environment. Keep research/trading disabled for initial smoke tests.
6. Point a staging domain at this VPS, then run `docker compose up -d --build`.
7. Verify migration/provision exit codes and web/worker status. Check `/api/health`, unauthorized dashboard redirect, valid/invalid login, secure cookies, CSRF rejection, worker heartbeat and recent market timestamps. Confirm no database port is published.
8. Verify the initialized bankroll is exactly $1,000 and there are no fixture records. Enable research with the daily/lifetime caps. Verify accepted evidence and explicit rejected decisions before enabling paper execution.
9. Execute an isolated fixture-based end-to-end test database including loss, split resolution, retries, stale feeds and restart recovery. Never contaminate the experiment database with synthetic trades.

## Domain cutover

After staging verification and backup restoration verification, route the **identified** replacement domain to the new app and update `APP_ORIGIN`. Check HTTPS and login from an external browser. Preserve the old private backup and rollback configuration. Remove old public content only within the resolved, verified target path and only after cutover succeeds. Never remove sibling domain directories.

## Operations still to configure

- Automated encrypted database backups, restore drills, and external audit-head anchoring.
- External uptime/heartbeat alerts and disk-growth monitoring.
- PostgreSQL retention/partition planning for order-book snapshots.
- Exact venue fees and any in-play order restrictions.
- A reviewed correlation taxonomy beyond category-level limits.
- Broad soak testing with the actual VPS, including restarts and API outages.

Do not label the deployment production-verified until these checks have actual recorded results.
