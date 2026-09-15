import { test } from "node:test";
import assert from "node:assert/strict";
import {
  hashPassword,
  verifyPassword,
  createSession,
  verifySession,
} from "../src/auth";
test("password hashing and signed session tampering", () => {
  const h = hashPassword("test-fixture-long-password");
  assert.ok(verifyPassword("test-fixture-long-password", h));
  assert.equal(verifyPassword("wrong", h), false);
  process.env.SESSION_SECRET = "test-only-secret-with-32-characters-or-more";
  const s = createSession();
  assert.ok(verifySession(s));
  assert.equal(verifySession(s + "x"), false);
  assert.equal(verifySession(s + ".extra"), false);
});
