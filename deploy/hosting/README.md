# Current Hostinger compatibility deployment

The owner selected paycheckadvisor.com and explicitly requested removal of the old site without retaining backups. The old WordPress directory and all its `wp_` tables have been removed; sibling domains were not modified.

## Layout

- Public web directory: only `index.php` and `.htaccess`.
- Private application root: `/home/u152823332/apps/polylab`.
- `current` points to an immutable build release directory.
- `production.env` holds secrets with mode 0600.
- `pgdata` stores the actual PostgreSQL cluster, outside releases.
- `runtime` contains `embedded-postgres@18.4.0-beta.17`, which launches the PostgreSQL 18.4 binary as the account user. Data persistence is explicitly enabled.
- `hosting/supervisor.mjs` owns PostgreSQL and restarts the Node web and worker children after exit. A `flock` lock prevents duplicate supervisors.
- Node runtime: `/opt/alt/alt-nodejs24/root/usr/bin/node`.
- Database binds **127.0.0.1:31824**; web binds **127.0.0.1:31823**. The PHP proxy forwards only to that fixed web endpoint.

## Build and restart

This server's older glibc cannot load the current native Next SWC binary. Build with `next build --webpack`, which uses its supported WebAssembly fallback. Limit compilation to two CPUs and a 1 GB JavaScript heap. Build into a new release, then change the `current` symlink. Keep PostgreSQL data and secrets outside the release.

Start the supervisor with the installed Node binary, `--env-file` pointing to the private production environment, and `flock -n` against `supervisor.lock`. Redirect logs to the private `logs` directory. For a controlled restart send SIGTERM only to the exact supervisor process, wait for shutdown, then start it again. Validate `/api/health` and authenticated login afterward.

## Limits

This is a shared-host compatibility deployment, not the separate VPS requested in the original brief. It has no verified system-service startup at machine boot. The PHP proxy attempts a locked restart only when its host permits `proc_open`; availability must be checked on the hosting plan. A host-wide reboot/process eviction can interrupt unattended scanning. Move the same application to the VPS Compose services for managed restart policies and stronger operational isolation.

The current public directory does not contain keys, database files, dependencies or source. Do not copy `.env`, PostgreSQL data or access credentials there. Do not expose either private port publicly.

