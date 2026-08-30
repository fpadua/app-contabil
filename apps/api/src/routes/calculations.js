import { monetaryCorrectionSchema } from "../schemas/calculation-schema.js";
import { calculateMonetaryCorrection } from "../services/calculation-service.js";

export async function calculationRoutes(app) {
  app.post("/monetary-correction", async (request, reply) => {
    const parsed = monetaryCorrectionSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ code: "INVALID_CALCULATION_INPUT", issues: parsed.error.issues });
    try {
      return await calculateMonetaryCorrection(parsed.data);
    } catch (error) {
      if (error.code === "MISSING_INDEX_PERIODS") return reply.status(409).send({ code: error.code, indexSlug: error.slug, missingPeriods: error.missingPeriods });
      throw error;
    }
  });
}
