import { test } from "node:test";
import assert from "node:assert/strict";
import { runActive, researchWindowOpen } from "../src/run-window";
test("timed run fails closed and reserves ten minutes for in-flight research", () => {
  process.env.RUN_START_AT = "2026-09-15T08:23:26Z";
  process.env.RUN_END_AT = "2026-09-15T16:23:26Z";
  assert.equal(runActive(Date.parse("2026-09-15T08:23:25Z")), false);
  assert.equal(runActive(Date.parse("2026-09-15T08:23:26Z")), true);
  assert.equal(researchWindowOpen(Date.parse("2026-09-15T16:14:26Z")), false);
  assert.equal(runActive(Date.parse("2026-09-15T16:23:26Z")), false);
  process.env.RUN_END_AT = "invalid";
  assert.equal(runActive(), false);
  delete process.env.RUN_END_AT;
  delete process.env.RUN_START_AT;
});
