import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import { clientRoutes } from "../src/routes/clients.js";
import { documentRoutes } from "../src/routes/documents.js";
import { processRoutes } from "../src/routes/processes.js";

const NOT_FOUND = () => {
  const error = new Error("Record not found");
  error.code = "P2025";
  throw error;
};

const UUID_1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const UUID_MISSING = "ffffffff-ffff-4fff-8fff-ffffffffffff";

async function buildApp(plugin, prefix, repository) {
  const app = Fastify();
  await app.register(plugin, { prefix, repository });
  return app;
}

test("clientRoutes: CRUD completo com repositório injetado", async (t) => {
  const repository = {
    list: async () => [{ id: UUID_1, name: "Maria" }],
    listOptions: async () => [{ id: UUID_1, name: "Maria" }],
    findById: async (id) => (id === UUID_1 ? { id, name: "Maria" } : null),
    create: async (data) => ({ id: "new-1", ...data }),
    update: async (id, data) => (id === UUID_1 ? { id, ...data } : NOT_FOUND()),
    remove: async (id) => { if (id !== UUID_1) NOT_FOUND(); },
  };
  const app = await buildApp(clientRoutes, "/api/clients", repository);
  t.after(() => app.close());

  const list = await app.inject({ method: "GET", url: "/api/clients" });
  assert.equal(list.statusCode, 200);
  assert.equal(list.json().length, 1);

  const created = await app.inject({ method: "POST", url: "/api/clients", payload: { name: "Ana" } });
  assert.equal(created.statusCode, 201);
  assert.equal(created.json().name, "Ana");

  const invalid = await app.inject({ method: "POST", url: "/api/clients", payload: { name: "" } });
  assert.equal(invalid.statusCode, 400);
  assert.equal(invalid.json().code, "INVALID_CLIENT_INPUT");

  const found = await app.inject({ method: "GET", url: `/api/clients/${UUID_1}` });
  assert.equal(found.statusCode, 200);
  assert.equal(found.json().id, UUID_1);

  const missing = await app.inject({ method: "GET", url: "/api/clients/nao-existe" });
  assert.equal(missing.json().code, "INVALID_ID");

  const updated = await app.inject({ method: "PUT", url: `/api/clients/${UUID_1}`, payload: { status: "Inativo" } });
  assert.equal(updated.statusCode, 200);
  assert.equal(updated.json().status, "Inativo");

  const updateMissing = await app.inject({ method: "PUT", url: `/api/clients/${UUID_MISSING}`, payload: { status: "Inativo" } });
  assert.equal(updateMissing.statusCode, 404);
  assert.equal(updateMissing.json().code, "NOT_FOUND");

  const deleted = await app.inject({ method: "DELETE", url: `/api/clients/${UUID_1}` });
  assert.equal(deleted.statusCode, 204);

  const deleteMissing = await app.inject({ method: "DELETE", url: `/api/clients/${UUID_MISSING}` });
  assert.equal(deleteMissing.statusCode, 404);
});

test("processRoutes: cria e recusa processo sem título", async (t) => {
  const repository = {
    list: async () => [],
    findById: async () => null,
    create: async (data) => ({ id: "p1", ...data }),
  };
  const app = await buildApp(processRoutes, "/api/processes", repository);
  t.after(() => app.close());

  const created = await app.inject({ method: "POST", url: "/api/processes", payload: { title: "Contrato 2021", calculationType: "Financiamento SAC" } });
  assert.equal(created.statusCode, 201);
  assert.equal(created.json().calculationType, "Financiamento SAC");

  const invalid = await app.inject({ method: "POST", url: "/api/processes", payload: {} });
  assert.equal(invalid.statusCode, 400);
  assert.equal(invalid.json().code, "INVALID_PROCESS_INPUT");
});

test("documentRoutes: cria documento com fileSize em string", async (t) => {
  const repository = {
    list: async () => [],
    findById: async () => null,
    create: async (data) => ({ id: "d1", ...data }),
  };
  const app = await buildApp(documentRoutes, "/api/documents", repository);
  t.after(() => app.close());

  const created = await app.inject({ method: "POST", url: "/api/documents", payload: { title: "Contrato.pdf", category: "Contrato", fileSize: "2048" } });
  assert.equal(created.statusCode, 201);
  assert.equal(created.json().fileSize, 2048);
});