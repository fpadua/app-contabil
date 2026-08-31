import assert from "node:assert/strict";
import test from "node:test";
import { clientCreateSchema, documentCreateSchema, processCreateSchema, processUpdateSchema } from "../src/schemas/record-schemas.js";

test("clientCreateSchema aplica padrões e valida campos obrigatórios", () => {
  const parsed = clientCreateSchema.safeParse({ name: "  Maria  " });
  assert.equal(parsed.success, true);
  assert.equal(parsed.data.name, "Maria");
  assert.equal(parsed.data.personType, "Pessoa física");
  assert.equal(parsed.data.status, "Ativo");

  assert.equal(clientCreateSchema.safeParse({ name: "" }).success, false);
  assert.equal(clientCreateSchema.safeParse({}).success, false);
});

test("clientCreateSchema recusa e-mail inválido e normaliza campos vazios", () => {
  assert.equal(clientCreateSchema.safeParse({ name: "Maria", email: "invalido" }).success, false);
  const parsed = clientCreateSchema.safeParse({ name: "Maria", email: "", phone: "   " });
  assert.equal(parsed.success, true);
  assert.equal(parsed.data.email, undefined);
  assert.equal(parsed.data.phone, undefined);
});

test("processCreateSchema exige título e aplica padrões", () => {
  assert.equal(processCreateSchema.safeParse({}).success, false);
  const parsed = processCreateSchema.safeParse({ title: "Processo 042" });
  assert.equal(parsed.success, true);
  assert.equal(parsed.data.calculationType, "Correção monetária");
  assert.equal(parsed.data.status, "Em andamento");
});

test("processUpdateSchema aceita null em campos opcionais ao editar", () => {
  const parsed = processUpdateSchema.safeParse({ status: "Concluído", clientId: null, court: null, notes: null });
  assert.equal(parsed.success, true);
  assert.equal(parsed.data.status, "Concluído");
  assert.equal(parsed.data.clientId, undefined);
  assert.equal(parsed.data.court, undefined);
  assert.equal(parsed.data.notes, undefined);
});

test("documentCreateSchema exige título e categoria e converte fileSize", () => {
  assert.equal(documentCreateSchema.safeParse({ title: "Doc" }).success, false);
  const parsed = documentCreateSchema.safeParse({ title: "Contrato.pdf", category: "Contrato", fileSize: "2048" });
  assert.equal(parsed.success, true);
  assert.equal(parsed.data.fileSize, 2048);
  assert.equal(parsed.data.status, "Em revisão");
});