import { calculationUpdateSchema, monetaryCorrectionSchema, runCalculationSchema, saveCalculationSchema } from "../schemas/calculation-schema.js";
import { calculateJudicialCorrection, calculateMonetaryCorrection, calculatePrice, calculateSac, calculateSalaryDifference } from "../services/calculation-service.js";
import { exportCalculationPdf, slugFileName } from "../services/calculation-export-service.js";
import { CalculationRepository } from "../repositories/calculation-repository.js";
import { handleRecordError, parseUuidParam } from "./record-route-helpers.js";

const calculators = {
  monetary: calculateMonetaryCorrection,
  sac: calculateSac,
  price: calculatePrice,
  salary: calculateSalaryDifference,
  judicial: calculateJudicialCorrection,
};

export async function calculationRoutes(app, { repository = new CalculationRepository(), exportPdf = exportCalculationPdf } = {}) {
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

  app.post("/run", async (request, reply) => {
    const parsed = runCalculationSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ code: "INVALID_CALCULATION_INPUT", issues: parsed.error.issues });
    const { type, ...input } = parsed.data;
    try {
      return await calculators[type](input);
    } catch (error) {
      if (error.code === "MISSING_INDEX_PERIODS") return reply.status(409).send({ code: error.code, indexSlug: error.slug, missingPeriods: error.missingPeriods });
      if (error.code === "JUDICIAL_NO_FIRST_PHASE" || error.code === "JUDICIAL_NO_SELIC") return reply.status(400).send({ code: error.code, message: error.message });
      throw error;
    }
  });

  app.get("/", async (request) => repository.list({
    clientId: request.query.clientId || undefined,
    processId: request.query.processId || undefined,
  }));

  app.get("/:id", async (request, reply) => {
    const id = parseUuidParam(request, reply);
    if (!id) return reply;
    const record = await repository.findById(id);
    if (!record) return reply.status(404).send({ code: "NOT_FOUND" });
    return record;
  });

  app.get("/:id/export", async (request, reply) => {
    const id = parseUuidParam(request, reply);
    if (!id) return reply;
    const format = String(request.query.format ?? "").toLowerCase();
    if (format !== "pdf") return reply.status(400).send({ code: "INVALID_EXPORT_FORMAT", message: "Formato suportado: pdf." });
    const record = await repository.findById(id);
    if (!record) return reply.status(404).send({ code: "NOT_FOUND" });
    const buffer = await exportPdf(record);
    reply.header("Content-Type", "application/pdf");
    reply.header("Content-Disposition", `attachment; filename="memoria-de-calculo.pdf"; filename*=UTF-8''${encodeURIComponent(`${slugFileName(record.title)}.pdf`)}`);
    return reply.send(buffer);
  });

  app.post("/", async (request, reply) => {
    const parsed = saveCalculationSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ code: "INVALID_CALCULATION_INPUT", issues: parsed.error.issues });
    const { result, startDate: draftStartDate, endDate: draftEndDate, principalInCents: draftPrincipalInCents, draftForm, ...record } = parsed.data;
    if (!result) {
      return reply.status(201).send(await repository.create({
        ...record,
        indexSlug: null,
        startDate: new Date(`${draftStartDate}T00:00:00.000Z`),
        endDate: new Date(`${draftEndDate}T00:00:00.000Z`),
        principalInCents: draftPrincipalInCents,
        accumulatedFactor: null,
        correctedInCents: null,
        correctionInCents: null,
        months: null,
        installments: null,
        params: draftForm ? { draftForm } : null,
      }));
    }
    return reply.status(201).send(await repository.create({
      ...record,
      indexSlug: result.indexSlug ?? null,
      startDate: new Date(`${result.startDate}T00:00:00.000Z`),
      endDate: new Date(`${result.endDate}T00:00:00.000Z`),
      principalInCents: result.principalInCents,
      accumulatedFactor: result.accumulatedFactor,
      correctedInCents: result.correctedInCents,
      correctionInCents: result.correctionInCents,
      traceabilityRuleId: result.traceabilityRuleId,
      months: result.months ?? null,
      installments: result.installments ?? null,
      params: result.params ?? null,
    }));
  });

  app.put("/:id", async (request, reply) => {
    const id = parseUuidParam(request, reply);
    if (!id) return reply;
    const parsed = calculationUpdateSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ code: "INVALID_CALCULATION_INPUT", issues: parsed.error.issues });
    try {
      return await repository.update(id, parsed.data);
    } catch (error) {
      if (error.code === "P2003") return reply.status(400).send({ code: "INVALID_REFERENCE", message: "O cliente ou o processo informado não existe." });
      return handleRecordError(reply, error);
    }
  });

  app.delete("/:id", async (request, reply) => {
    const id = parseUuidParam(request, reply);
    if (!id) return reply;
    try {
      await repository.remove(id);
      return reply.status(204).send();
    } catch (error) {
      return handleRecordError(reply, error);
    }
  });
}
