import { test } from "node:test";
import assert from "node:assert/strict";
import { canonicalSource } from "../src/provenance";
test("tracking parameters do not break source identity", () => {
  assert.equal(
    canonicalSource("https://example.com/article?msockid=abc"),
    canonicalSource("https://example.com/article"),
  );
  assert.notEqual(
    canonicalSource("https://example.com/article?id=1"),
    canonicalSource("https://example.com/article?id=2"),
  );
  assert.throws(() => canonicalSource("javascript:alert(1)"));
});
