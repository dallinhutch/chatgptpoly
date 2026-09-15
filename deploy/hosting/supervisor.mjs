import { existsSync, openSync, closeSync, writeFileSync, renameSync } from "node:fs";
import { spawn } from "node:child_process";
import pg from "../runtime/node_modules/pg/lib/index.js";
const base = "/home/u152823332/apps/polylab", app = base + "/current";
const binary = base + "/runtime/node_modules/@embedded-postgres/linux-x64/native/bin/postgres";
const ownerEnv = { ...process.env, LOCAL_DATABASE_PATH: "", DATABASE_URL: `postgresql://polylab:${process.env.POSTGRES_PASSWORD}@127.0.0.1:31824/polylab` };
const env = { ...ownerEnv, NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1", DATABASE_URL: `postgresql://polylab_runtime:${process.env.APP_DATABASE_PASSWORD}@127.0.0.1:31824/polylab` };
let stopping = false, configured = false, generation = 0;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
process.on("SIGTERM", () => { stopping = true; });
process.on("SIGINT", () => { stopping = true; });
function log(event, detail = {}) { console.log(JSON.stringify({ at: new Date().toISOString(), event, ...detail })); }
function launch(name, executable, args, childEnv = env) {
  const fd = openSync(base + "/logs/" + name + ".log", "a", 0o600);
  const child = spawn(executable, args, { cwd: app, env: childEnv, stdio: ["ignore", fd, fd] });
  closeSync(fd);
  child.on("error", e => { child.launchError = e; log("PROCESS_ERROR", { name, message: e.message }); });
  child.on("exit", (code, signal) => log("PROCESS_EXIT", { name, pid: child.pid, code, signal }));
  return child;
}
const alive = child => child && !child.launchError && child.exitCode === null && child.signalCode === null;
async function terminate(child, signal = "SIGTERM") {
  if (!alive(child)) return;
  child.kill(signal);
  for (let i = 0; i < 80 && alive(child); i++) await sleep(100);
  if (alive(child)) { log("PROCESS_FORCE_STOP", { pid: child.pid }); child.kill("SIGKILL"); }
  for (let i = 0; i < 30 && alive(child); i++) await sleep(100);
}
async function probe() {
  const client = new pg.Client({ host: "127.0.0.1", port: 31824, user: "polylab", password: process.env.POSTGRES_PASSWORD, database: "postgres", connectionTimeoutMillis: 2000, query_timeout: 2000 });
  client.on("error", () => {});
  try { await client.connect(); await client.query("SELECT 1"); return true; }
  catch { return false; }
  finally { await client.end().catch(() => {}); }
}
async function setup(script) {
  const child = launch("setup", process.execPath, ["--import", "tsx", script], ownerEnv);
  for (let i = 0; i < 600 && alive(child) && !stopping; i++) await sleep(100);
  if (alive(child)) await terminate(child);
  if (child.exitCode !== 0) throw Error("Setup failed: " + script);
}
function status(state, extra = {}) {
  const value = { at: new Date().toISOString(), supervisorPid: process.pid, generation, state, ...extra };
  writeFileSync(base + "/service-status.next.json", JSON.stringify(value), { mode: 0o600 });
  renameSync(base + "/service-status.next.json", base + "/service-status.json");
}
if (!existsSync(base + "/pgdata/PG_VERSION")) throw Error("Existing database required; refusing to initialize a replacement");
while (!stopping) {
  let database, web, worker;
  generation++;
  try {
    status("starting");
    database = launch("postgres", binary, ["-D", base + "/pgdata", "-p", "31824", "-h", "127.0.0.1", "-c", "unix_socket_directories=" + base, "-c", "shared_buffers=16MB", "-c", "work_mem=2MB", "-c", "max_connections=30", "-c", "io_method=sync"]);
    let ready = false;
    for (let i = 0; i < 30 && alive(database) && !stopping; i++) {
      if (await probe()) { ready = true; break; }
      await sleep(1000);
    }
    if (!ready) throw Error("Database did not become ready");
    if (!configured) {
      await setup("scripts/migrate.ts");
      await setup("scripts/provision-role.ts");
      configured = true;
    }
    if (stopping) break;
    web = launch("web", process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "31823"]);
    worker = launch("worker", process.execPath, ["--import", "tsx", "src/worker.ts"]);
    let failedProbes = 0, ticks = 0;
    log("GENERATION_STARTED", { generation, databasePid: database.pid, webPid: web.pid, workerPid: worker.pid });
    while (!stopping) {
      if (!alive(database)) throw Error("Database exited");
      if (!alive(web)) { web = launch("web", process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "31823"]); }
      if (!alive(worker)) { worker = launch("worker", process.execPath, ["--import", "tsx", "src/worker.ts"]); }
      if (ticks++ % 10 === 0) {
        failedProbes = await probe() ? 0 : failedProbes + 1;
        status(failedProbes ? "degraded" : "healthy", { databasePid: database.pid, webPid: web.pid, workerPid: worker.pid });
        if (failedProbes >= 2) throw Error("Database health check failed twice");
      }
      await sleep(1000);
    }
  } catch (e) { log("RECOVERING", { message: e.message, generation }); status("recovering"); }
  finally {
    // Drain application processes before PostgreSQL, and never overlap worker leases.
    await Promise.all([terminate(web), terminate(worker)]);
    await terminate(database, "SIGINT");
  }
  if (!stopping) await sleep(2000);
}
status("stopped");
log("SUPERVISOR_STOPPED");
