import { db } from "../../../src/db";
export async function GET() {
  try {
    await db().query("SELECT 1");
    return Response.json({ status: "ok", mode: "paper" });
  } catch {
    return Response.json({ status: "unavailable" }, { status: 503 });
  }
}
