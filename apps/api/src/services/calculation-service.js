import { applyAccumulatedFactor } from "@contabil/calculation-engine";
import { EconomicIndexRepository } from "../repositories/economic-index-repository.js";
import { assertIndexCoverage } from "./index-coverage-service.js";

export async function calculateMonetaryCorrection(input, repository = new EconomicIndexRepository()) {
  await assertIndexCoverage({ repository, slug: input.indexSlug, startDate: input.startDate, endDate: input.endDate });
  const correctedInCents = applyAccumulatedFactor(input.principalInCents, input.accumulatedFactor);
  return { ...input, correctedInCents, correctionInCents: correctedInCents - input.principalInCents, traceabilityRuleId: "REGRA-CM-001" };
}
