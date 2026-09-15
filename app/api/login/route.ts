import { NextResponse } from "next/server";
import { checkOrigin, verifyPassword, createSession } from "../../../src/auth";
import { transaction } from "../../../src/db";
export async function POST(req: Request) {
  if (!checkOrigin(req))
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  try {
    const allowed = await transaction(async (q) => {
      const row = (
        await q.query(
          "INSERT INTO login_attempts(bucket,attempts,window_start) VALUES('admin',1,now()) ON CONFLICT(bucket) DO UPDATE SET attempts=CASE WHEN login_attempts.window_start < now()-interval '15 minutes' THEN 1 ELSE login_attempts.attempts+1 END,window_start=CASE WHEN login_attempts.window_start < now()-interval '15 minutes' THEN now() ELSE login_attempts.window_start END RETURNING attempts",
        )
      ).rows[0];
      return row.attempts <= 10;
    });
    if (!allowed)
      return NextResponse.json(
        { error: "Too many attempts. Try again in 15 minutes." },
        { status: 429 },
      );
    const form = await req.formData(),
      password = String(form.get("password") ?? "");
    if (
      password.length > 1024 ||
      !process.env.ADMIN_PASSWORD_HASH ||
      !verifyPassword(password, process.env.ADMIN_PASSWORD_HASH)
    )
      return NextResponse.redirect(
        new URL("/login?error=1", process.env.APP_ORIGIN),
        303,
      );
    const response = NextResponse.redirect(
      new URL("/", process.env.APP_ORIGIN),
      303,
    );
    response.cookies.set("polylab_session", createSession(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 43200,
    });
    return response;
  } catch {
    return NextResponse.json(
      { error: "Login unavailable. Check server configuration." },
      { status: 503 },
    );
  }
}
