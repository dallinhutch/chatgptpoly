import { authenticated } from "../../../src/auth";
import { db } from "../../../src/db";
export async function GET(request: Request) {
  if (!(await authenticated()))
    return new Response("Unauthorized", { status: 401 });
  const cursor = new URL(request.url).searchParams.get("after") ?? "0";
  if (!/^\d+$/.test(cursor))
    return new Response("Invalid cursor", { status: 400 });
  const rows = (
    await db().query(
      "SELECT * FROM audit_events WHERE id>$1 ORDER BY id LIMIT 1000",
      [cursor],
    )
  ).rows;
  return new Response(rows.map((r) => JSON.stringify(r)).join("\n"), {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Content-Disposition": 'attachment; filename="polylab-audit.jsonl"',
      "X-Next-Cursor": rows.at(-1)?.id ?? cursor,
    },
  });
}
