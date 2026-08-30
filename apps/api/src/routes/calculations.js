import { monetaryCorrectionSchema } from "../schemas/calculation-schema.js";
import { calculateMonetaryCorrection } from "../services/calculation-service.js";

export async function calculationRoutes(app) {
  app.post("/monetary-correction", async (request, reply) => {
    const parsed = monetaryCorrectionSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ code: "INVALID_CALCULATION_INPUT", issues: parsed.error.issues });
    return calculateMonetaryCorrection(parsed.data);
  });
}
