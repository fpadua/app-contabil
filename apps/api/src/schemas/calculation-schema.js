import { z } from "zod";

const monetaryPeriodSchema = z.object({
  indexSlug: z.string().min(1),
  startDate: z.iso.date(),
  endDate: z.iso.date(),
});

export const monetaryCorrectionSchema = z.object({
  principalInCents: z.number().int().positive(),
  accumulatedFactor: z.number().positive().optional(),
  indexSlug: z.string().min(1),
  startDate: z.iso.date(),
  endDate: z.iso.date(),
  periods: z.array(monetaryPeriodSchema).max(10).optional(),
}).refine((data) => {
  if (!data.periods || data.periods.length === 0) return true;
  const sorted = [...data.periods].sort((a, b) => a.startDate.localeCompare(b.startDate));
  if (data.accumulatedFactor) return true;
  if (sorted[0].startDate !== data.startDate || sorted[sorted.length - 1].endDate !== data.endDate) return false;
  for (let index = 0; index < sorted.length - 1; index += 1) {
    if (sorted[index].endDate >= sorted[index + 1].startDate) return false;
  }
  return true;
}, { message: "Os períodos devem cobrir integralmente o intervalo sem sobreposição." });

const optionalIndexSlug = z.preprocess((value) => {
  if (typeof value === "string" && value.trim() === "") return undefined;
  return value;
}, z.string().min(1).optional());

const scheduleInputSchema = z.object({
  principalInCents: z.number().int().positive(),
  monthlyInterestRate: z.number().nonnegative(),
  months: z.number().int().positive(),
  indexSlug: optionalIndexSlug,
  startDate: z.iso.date(),
  endDate: z.iso.date(),
});

export const sacSchema = scheduleInputSchema;
export const priceSchema = scheduleInputSchema;

export const salaryDifferenceSchema = z.object({
  salaryPreviousInCents: z.number().int().positive(),
  salaryNewInCents: z.number().int().positive(),
  decimoTerceiro: z.boolean().default(true),
  vacationsWithBonus: z.boolean().default(true),
  indexSlug: optionalIndexSlug,
  startDate: z.iso.date(),
  endDate: z.iso.date(),
}).refine((data) => data.salaryNewInCents > data.salaryPreviousInCents, { message: "O salário novo deve ser maior que o anterior para haver diferença." });

export const judicialCorrectionSchema = z.object({
  principalInCents: z.number().int().positive(),
  selicAccumulatedFactor: z.number().positive().optional(),
  startDate: z.iso.date(),
  endDate: z.iso.date(),
});

export const runCalculationSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("monetary") }).merge(monetaryCorrectionSchema),
  z.object({ type: z.literal("sac") }).merge(scheduleInputSchema),
  z.object({ type: z.literal("price") }).merge(scheduleInputSchema),
  z.object({ type: z.literal("salary") }).merge(salaryDifferenceSchema),
  z.object({ type: z.literal("judicial") }).merge(judicialCorrectionSchema),
]);

const calculationMonthSchema = z.object({
  referenceDate: z.string().nullable().optional(),
  competence: z.string().min(1),
  factor: z.number().positive().nullable().optional(),
  accumulatedFactor: z.number().positive(),
  correctedInCents: z.number().int().positive(),
});

const resultBaseSchema = {
  principalInCents: z.number().int().positive(),
  startDate: z.iso.date(),
  endDate: z.iso.date(),
  accumulatedFactor: z.number().positive(),
  correctedInCents: z.number().int().positive(),
  correctionInCents: z.number().int(),
  traceabilityRuleId: z.string().min(1),
};

const monetaryResultSchema = z.object({
  type: z.literal("monetary"),
  ...resultBaseSchema,
  indexSlug: z.string().min(1),
  months: z.preprocess((value) => value ?? undefined, z.array(calculationMonthSchema).optional()),
});

const installmentSchema = z.object({
  installmentNumber: z.number().int().positive(),
  competence: z.string().optional(),
  factor: z.number().positive().optional(),
  accumulatedFactor: z.number().positive().optional(),
  amortizationInCents: z.number().int(),
  interestInCents: z.number().int(),
  installmentInCents: z.number().int(),
  remainingInCents: z.number().int(),
});

const scheduleResultSchema = z.object({
  type: z.enum(["sac", "price"]),
  ...resultBaseSchema,
  indexSlug: z.string().nullable(),
  installments: z.array(installmentSchema),
});

const salaryResultSchema = z.object({
  type: z.literal("salary"),
  ...resultBaseSchema,
  indexSlug: z.string().min(1),
  months: z.preprocess((value) => value ?? undefined, z.array(calculationMonthSchema).optional()),
  params: z.object({
    reflections: z.object({ decimoTerceiro: z.boolean(), vacationsWithBonus: z.boolean() }),
    monthlyDifferenceInCents: z.number().int().positive(),
  }),
});

const judicialResultSchema = z.object({
  type: z.literal("judicial"),
  ...resultBaseSchema,
  indexSlug: z.string().min(1),
  months: z.preprocess((value) => value ?? undefined, z.array(calculationMonthSchema).optional()),
});

export const calculationResultSchema = z.discriminatedUnion("type", [
  monetaryResultSchema,
  scheduleResultSchema,
  salaryResultSchema,
  judicialResultSchema,
]);

const legacyMonetaryResult = z.preprocess((value) => {
  if (value && typeof value === "object" && !("type" in value)) return { ...value, type: "monetary" };
  return value;
}, calculationResultSchema);

const optionalUuid = z.preprocess((value) => {
  if (value === "" || value === null) return undefined;
  return value;
}, z.string().uuid("Registro inválido.").optional());

const nullableUuid = z.preprocess((value) => {
  if (value === "") return null;
  return value;
}, z.string().uuid("Registro inválido.").nullable().optional());

export const saveCalculationSchema = z.object({
  title: z.preprocess((value) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed === "" ? undefined : trimmed;
  }, z.string().min(1, "O título é obrigatório.").default("Cálculo de correção monetária")),
  calculationType: z.preprocess((value) => (typeof value === "string" ? value.trim() : value), z.string().min(1).default("Correção monetária")),
  clientId: optionalUuid,
  processId: optionalUuid,
  status: z.preprocess((value) => (typeof value === "string" ? value.trim() : value), z.string().min(1).default("Concluído")),
  startDate: z.iso.date().optional(),
  endDate: z.iso.date().optional(),
  principalInCents: z.number().int().positive().optional(),
  result: legacyMonetaryResult.optional(),
}).refine((data) => data.result || (data.startDate && data.endDate && data.principalInCents), {
  message: "Informe o resultado do cálculo ou os dados de um rascunho (datas e valor).",
});

export const calculationUpdateSchema = z.object({
  title: z.preprocess((value) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed === "" ? undefined : trimmed;
  }, z.string().min(1, "O título é obrigatório.")).optional(),
  calculationType: z.preprocess((value) => (typeof value === "string" ? value.trim() : value), z.string().min(1)).optional(),
  status: z.preprocess((value) => (typeof value === "string" ? value.trim() : value), z.string().min(1)).optional(),
  clientId: nullableUuid, // null/"" desvincula o cálculo do cliente
  processId: nullableUuid, // null/"" desvincula o cálculo do processo
}).refine((data) => Object.keys(data).length > 0, { message: "Informe pelo menos um campo para atualizar." });