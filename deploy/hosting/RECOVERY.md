# Hosting recovery fix — September 15, 2026

## Confirmed defect and repair

The previous database launcher had no active PostgreSQL crash recovery. Its supervisor could remain alive holding the startup lock after PostgreSQL stopped, so visitor-triggered launches could not restore the site. The replacement supervises the database process directly, probes PostgreSQL every ten seconds, and restarts the database and dependent application processes on failure. Two failed probes also trigger recovery. Application processes drain before database shutdown; restarts cannot overlap workers. Log file descriptors are closed after launching children. PostgreSQL uses 16 MB shared buffers, 2 MB work memory, and synchronous I/O to reduce its process/memory footprint.

The original external cause of PostgreSQL termination is not established by the available logs. No claim is made that host-wide failures or machine reboots are impossible. This change addresses the demonstrated failure to recover.

## Live validation

A controlled PostgreSQL stop at 22:11:50 UTC was detected at 22:11:51. A replacement database, web process and worker launched at 22:11:54 without a manual restart. Application health returned OK. The database automatically retained its records. All 15 audit events verified; paper cash remained $1,000, no positions or fills, cumulative reservations $5 ($2 for the active run), and exactly one worker was present. The active run's $2 budget and 01:02:49 UTC deadline remain unchanged.

A private service-status.json now records supervisor PID, generation, state, child PIDs, and the last probe time. It contains no credentials and is stored outside the public directory. Structured supervisor logs record process exit codes/signals and recovery times to help identify future failures.
