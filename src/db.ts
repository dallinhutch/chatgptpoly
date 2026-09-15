import pg from "pg";
import { readFile, readdir, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { defaults } from "./config";
export interface DB {
  query(sql: string, values?: unknown[]): Promise<{ rows: any[] }>;
}
let pool: pg.Pool | undefined;
const localGlobal = globalThis as typeof globalThis & {
  localPg?: Promise<import("@electric-sql/pglite").PGlite>;
};
async function local() {
  if (process.env.NODE_ENV === "production")
    throw Error("Embedded database is local development only");
  return (localGlobal.localPg ??= import("@electric-sql/pglite").then(
    async ({ PGlite }) => {
      await mkdir(process.env.LOCAL_DATABASE_PATH!, { recursive: true });
      const p = new PGlite(process.env.LOCAL_DATABASE_PATH);
      await p.waitReady;
      return p;
    },
  ));
}
export function db(): DB {
  if (process.env.LOCAL_DATABASE_PATH)
    return {
      query: async (sql, values) => {
        const p = await local();
        if (!values && sql.includes(";")) {
          const results = await p.exec(sql);
          return results[results.length - 1] ?? { rows: [] };
        }
        return p.query(sql, values);
      },
    };
  if (!process.env.DATABASE_URL) throw Error("DATABASE_URL is not configured");
  return (pool ??= new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 8,
    connectionTimeoutMillis: 10000,
  }));
}
export async function transaction<T>(fn: (q: DB) => Promise<T>): Promise<T> {
  if (process.env.LOCAL_DATABASE_PATH) {
    const p = await local();
    return p.transaction(async (t) =>
      fn({
        query: async (sql, values) => {
          if (!values && sql.includes(";")) {
            const r = await t.exec(sql);
            return r[r.length - 1] ?? { rows: [] };
          }
          return t.query(sql, values);
        },
      }),
    );
  }
  const client = await (db() as pg.Pool).connect();
  try {
    await client.query("BEGIN");
    const value = await fn(client);
    await client.query("COMMIT");
    return value;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
export async function migrate(q: DB) {
  await q.query(
    "CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY,applied_at timestamptz DEFAULT now())",
  );
  for (const name of (await readdir("migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    if (
      (
        await q.query("SELECT name FROM schema_migrations WHERE name=$1", [
          name,
        ])
      ).rows.length
    )
      continue;
    await q.query(await readFile(`migrations/${name}`, "utf8"));
    await q.query("INSERT INTO schema_migrations(name) VALUES($1)", [name]);
  }
  if (!(await q.query("SELECT id FROM strategy_versions LIMIT 1")).rows.length)
    await q.query("INSERT INTO strategy_versions(config) VALUES($1)", [
      JSON.stringify(defaults),
    ]);
}
export async function audit(q: DB, kind: string, payload: unknown) {
  await q.query("SELECT id FROM portfolio WHERE id=1 FOR UPDATE");
  const previous =
    (await q.query("SELECT hash FROM audit_events ORDER BY id DESC LIMIT 1"))
      .rows[0]?.hash ?? "GENESIS";
  const normalized = JSON.parse(JSON.stringify(payload)),
    canonical = canonicalJson(normalized),
    hash = createHash("sha256")
      .update(previous + "\n" + kind + "\n" + canonical)
      .digest("hex");
  await q.query(
    "INSERT INTO audit_events(kind,payload,previous_hash,hash) VALUES($1,$2,$3,$4)",
    [kind, JSON.stringify(normalized), previous, hash],
  );
}
export function canonicalJson(value: any): string {
  if (Array.isArray(value))
    return "[" + value.map(canonicalJson).join(",") + "]";
  if (value && typeof value === "object")
    return (
      "{" +
      Object.keys(value)
        .sort()
        .map((k) => JSON.stringify(k) + ":" + canonicalJson(value[k]))
        .join(",") +
      "}"
    );
  return JSON.stringify(value);
}
export async function closeDatabase() {
  if (localGlobal.localPg) await (await localGlobal.localPg).close();
  if (pool) await pool.end();
}
