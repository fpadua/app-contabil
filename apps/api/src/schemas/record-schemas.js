import { z } from "zod";

function optionalString() {
  return z.preprocess((value) => {
    if (value === null || value === undefined) return undefined;
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed === "" ? undefined : trimmed;
  }, z.string().optional());
}

function optionalUuid() {
  return z.preprocess((value) => (value === null || value === undefined ? undefined : value), z.string().uuid().optional());
}

export const clientCreateSchema = z.object({
  personType: z.enum(["Pessoa física", "Pessoa jurídica"]).default("Pessoa física"),
  name: z.preprocess((value) => (typeof value === "string" ? value.trim() : value), z.string().min(1, "O nome é obrigatório.")),
  document: optionalString(),
  email: z.preprocess((value) => (typeof value === "string" ? value.trim() || undefined : value), z.string().email("E-mail inválido.").optional()),
  phone: optionalString(),
  notes: optionalString(),
  status: z.preprocess((value) => (typeof value === "string" ? value.trim() : value), z.string().min(1).default("Ativo")),
});

export const clientUpdateSchema = clientCreateSchema.partial().refine((data) => Object.keys(data).length > 0, { message: "Informe pelo menos um campo para atualizar." });

export const processCreateSchema = z.object({
  clientId: optionalUuid(),
  title: z.preprocess((value) => (typeof value === "string" ? value.trim() : value), z.string().min(1, "O título do processo é obrigatório.")),
  number: optionalString(),
  calculationType: z.preprocess((value) => (typeof value === "string" ? value.trim() : value), z.string().min(1).default("Correção monetária")),
  status: z.preprocess((value) => (typeof value === "string" ? value.trim() : value), z.string().min(1).default("Em andamento")),
  court: optionalString(),
  division: optionalString(),
  notes: optionalString(),
});

export const processUpdateSchema = processCreateSchema.partial().refine((data) => Object.keys(data).length > 0, { message: "Informe pelo menos um campo para atualizar." });

export const documentCreateSchema = z.object({
  title: z.preprocess((value) => (typeof value === "string" ? value.trim() : value), z.string().min(1, "O título do documento é obrigatório.")),
  category: z.preprocess((value) => (typeof value === "string" ? value.trim() : value), z.string().min(1, "A categoria é obrigatória.")),
  description: optionalString(),
  fileName: optionalString(),
  fileSize: z.preprocess((value) => (typeof value === "string" && value !== "" ? Number(value) : value), z.number().int().positive().optional()),
  mimeType: optionalString(),
  storageKey: optionalString(),
  processId: optionalUuid(),
  source: optionalString(),
  status: z.preprocess((value) => (typeof value === "string" ? value.trim() : value), z.string().min(1).default("Em revisão")),
});

export const documentUpdateSchema = documentCreateSchema.partial().refine((data) => Object.keys(data).length > 0, { message: "Informe pelo menos um campo para atualizar." });