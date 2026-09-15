import { test } from "node:test";
import assert from "node:assert/strict";
import { recommendationMetrics } from "../src/recommendation";
test("recommendations reject low margins even with high win probability", () => {
  assert.equal(recommendationMetrics(.90, .90, 86, 100), null);
  assert.equal(recommendationMetrics(.79, .90, 60, 100), null);
  assert.equal(recommendationMetrics(.90, .79, 60, 100), null);
  assert.equal(recommendationMetrics(.81, .90, 78, 100), null);
  assert.equal(recommendationMetrics(NaN, .90, 60, 100), null);
});
test("recommendation return uses complete cost and distinguishes expected return from win payout", () => {
  const r = recommendationMetrics(.9, .85, 70, 100)!;
  assert.equal(r.recommendedAmount, 70);
  assert.equal(r.profitIfWin, 30);
  assert.equal(r.maxLoss, 70);
  assert.equal(r.returnIfWin, 30 / 70);
  assert.equal(r.expectedReturn, 20 / 70);
});
