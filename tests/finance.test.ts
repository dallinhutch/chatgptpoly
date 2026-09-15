import { test } from "node:test";
import assert from "node:assert/strict";
import { aggregate, simulateBuy, sizePosition, settle } from "../src/finance";
import { defaults } from "../src/config";
const now = new Date("2026-09-15T00:00:00Z");
test("fills walk actual depth and preserve cash including conservative fees", () => {
  const r = simulateBuy(
    [
      { price: ".4", quantity: "10" },
      { price: ".5", quantity: "100" },
    ],
    "10",
    ".5",
    0.03,
    now,
    now,
    15,
  );
  assert.equal(r.quantity, "20");
  assert.equal(r.spent, "9.600000");
  assert.equal(r.fills[0].quantity, "10");
  assert.equal(r.fills[1].quantity, "10");
});
test("partial depth and limit price prevent imaginary fills", () => {
  const r = simulateBuy(
    [
      { price: ".4", quantity: "2" },
      { price: ".8", quantity: "100" },
    ],
    "20",
    ".5",
    0,
    now,
    now,
    15,
  );
  assert.equal(r.quantity, "2");
  assert.equal(r.spent, "0.800000");
});
test("no future or stale quote execution", () => {
  for (const t of [
    new Date(now.getTime() + 1),
    new Date(now.getTime() - 16000),
  ])
    assert.throws(() =>
      simulateBuy([{ price: ".4", quantity: "10" }], "10", ".5", 0, t, now, 15),
    );
});
test("settlement handles wins losses and split cancellation exactly", () => {
  assert.deepEqual(settle("10", "4.3", "1"), {
    proceeds: "10.000000",
    pnl: "5.700000",
  });
  assert.equal(settle("10", "4.3", "0").pnl, "-4.300000");
  assert.equal(settle("10", "4.3", ".5").pnl, "0.700000");
});
test("hard limits override Kelly including correlation, reserve and drawdown", () => {
  const i = {
    probability: 0.8,
    price: ".4",
    confidence: 0.9,
    equity: "1000",
    cash: "1000",
    exposure: "0",
    categoryExposure: "0",
    correlatedExposure: "0",
    drawdown: 0,
  };
  assert.equal(sizePosition(i, defaults), "30.000000");
  assert.equal(
    sizePosition({ ...i, correlatedExposure: "59" }, defaults),
    "1.000000",
  );
  assert.equal(sizePosition({ ...i, cash: "500" }, defaults), "0.000000");
  assert.equal(sizePosition({ ...i, drawdown: 0.2 }, defaults), "0.000000");
});
test("high probability is not positive expected value", () => {
  assert.equal(
    sizePosition(
      {
        probability: 0.85,
        price: ".92",
        confidence: 0.9,
        equity: "1000",
        cash: "1000",
        exposure: "0",
        categoryExposure: "0",
        correlatedExposure: "0",
        drawdown: 0,
      },
      defaults,
    ),
    "0.000000",
  );
});
test("invalid amounts fail closed", () => {
  assert.throws(() => settle("-1", "1", "1"));
  assert.throws(() => settle("1", "1", "1.1"));
  assert.throws(() =>
    simulateBuy([{ price: "NaN", quantity: "2" }], "3", "1", 0, now, now, 15),
  );
});
test("quality weighted aggregation penalizes disagreement", () => {
  const r = aggregate([
    { probability: 0.7, confidence: 0.9, quality: 0.9 },
    { probability: 0.72, confidence: 0.9, quality: 0.9 },
    { probability: 0.1, confidence: 0.9, quality: 0.1 },
  ]);
  assert.ok(r.probability > 0.7);
  assert.ok(r.confidence < 0.7);
  assert.equal(r.median, 0.7);
  assert.throws(() => aggregate([]));
});
test("full analyst objects allow nonnumeric evidence fields", () => {
  const full = {
    probability: 0.5,
    confidence: 0.8,
    quality: 0.9,
    clearRules: true,
    sources: [],
  };
  assert.equal(aggregate([full, full, full]).probability, 0.5);
});
