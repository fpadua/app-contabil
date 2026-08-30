import assert from "node:assert/strict";
import test from "node:test";
import { applyAccumulatedFactor } from "../src/index.js";

test("REGRA-CM-001 aplica o fator acumulado e arredonda em centavos", () => {
  assert.equal(applyAccumulatedFactor(1_000_000, 1.097519), 1_097_519);
});

test("REGRA-CM-001 rejeita principal inválido", () => {
  assert.throws(() => applyAccumulatedFactor(0, 1.1), TypeError);
});
