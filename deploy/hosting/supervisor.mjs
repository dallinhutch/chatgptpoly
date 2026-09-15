import EmbeddedPostgres from "../runtime/node_modules/embedded-postgres/dist/index.js";
import { existsSync, openSync, renameSync } from "node:fs";
import { spawn } from "node:child_process";
const base = "/home/u152823332/apps/polylab",
  app = base + "/current";
const pg = new EmbeddedPostgres({
  databaseDir: base + "/pgdata",
  user: "polylab",
  password: process.env.POSTGRES_PASSWORD,
  port: 31824,
  persistent: true,
  authMethod: "scram-sha-256",
  initdbFlags: ["--locale=C", "--encoding=UTF8"],
  postgresFlags: [
    "-h",
    "127.0.0.1",
    "-c",
    "unix_socket_directories=" + base,
    "-c",
    "shared_buffers=32MB",
    "-c",
    "max_connections=30",
  ],
  onLog: (m) => console.log(m),
  onError: (m) => console.error(m),
});
if (!existsSync(base + "/pgdata/PG_VERSION")) await pg.initialise();
await pg.start();
const client = pg.getPgClient("postgres", "127.0.0.1");
await client.connect();
if (
  !(await client.query("SELECT 1 FROM pg_database WHERE datname='polylab'"))
    .rowCount
)
  await client.query("CREATE DATABASE polylab");
await client.end();
const ownerEnv = {
  ...process.env,
  LOCAL_DATABASE_PATH: "",
  DATABASE_URL: `postgresql://polylab:${process.env.POSTGRES_PASSWORD}@127.0.0.1:31824/polylab`,
};
function once(args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: app,
      env,
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("exit", (c) =>
      c === 0 ? resolve() : reject(Error("Setup process failed with " + c)),
    );
  });
}
await once(["--import", "tsx", "scripts/migrate.ts"], ownerEnv);
if (existsSync(base + "/experiment.json")) {
  await once(
    [
      "--import",
      "tsx",
      "scripts/import-experiment.ts",
      base + "/experiment.json",
    ],
    ownerEnv,
  );
  renameSync(base + "/experiment.json", base + "/experiment.imported.json");
}
await once(["--import", "tsx", "scripts/provision-role.ts"], ownerEnv);
const env = {
  ...ownerEnv,
  NODE_ENV: "production",
  DATABASE_URL: `postgresql://polylab_runtime:${process.env.APP_DATABASE_PASSWORD}@127.0.0.1:31824/polylab`,
  NEXT_TELEMETRY_DISABLED: "1",
};
const children = new Set();
let stopping = false;
function launch(name, args) {
  if (stopping) return;
  const fd = openSync(base + "/logs/" + name + ".log", "a", 0o600);
  const child = spawn(process.execPath, args, {
    cwd: app,
    env,
    stdio: ["ignore", fd, fd],
  });
  children.add(child);
  child.on("exit", () => {
    children.delete(child);
    if (!stopping) setTimeout(() => launch(name, args), 5000);
  });
  child.on("error", (e) => console.error(name, e.message));
}
launch("web", [
  "node_modules/next/dist/bin/next",
  "start",
  "--hostname",
  "127.0.0.1",
  "--port",
  "31823",
]);
launch("worker", ["--import", "tsx", "src/worker.ts"]);
async function stop() {
  if (stopping) return;
  stopping = true;
  for (const c of children) c.kill("SIGTERM");
  setTimeout(async () => {
    await pg.stop();
    process.exit(0);
  }, 5000);
}
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
