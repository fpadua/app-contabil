import { applyAccumulatedFactor } from "@contabil/calculation-engine";

export function calculateMonetaryCorrection(input) {
  const correctedInCents = applyAccumulatedFactor(input.principalInCents, input.accumulatedFactor);
  return { ...input, correctedInCents, correctionInCents: correctedInCents - input.principalInCents, traceabilityRuleId: "REGRA-CM-001" };
}
