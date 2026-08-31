import { createIndexProvider } from "../providers/index-provider-factory.js";
import { EconomicIndexRepository } from "../repositories/economic-index-repository.js";
import { SyncEconomicIndicesService } from "../services/sync-economic-indices-service.js";
import { RefreshEconomicIndexService } from "../services/refresh-economic-index-service.js";
import { ImportEconomicIndexService } from "../services/import-economic-index-service.js";
import { createTask, setTaskRunning, updateTask, finishTask } from "../services/task-manager.js";
import { getEnvironment } from "../config/env.js";
import { z } from "zod";

const targetSlugs = ["ipca", "ipca_e", "inpc", "igp_m", "tr"];
const syncRequestSchema = z.object({ from: z.string().regex(/^\d{4}-\d{2}$/).optional(), to: z.string().regex(/^\d{4}-\d{2}$/).optional() }).default({});

function startBackgroundTask({ type, label, worker }) {
  const task = createTask({ type, label });
  setTaskRunning(task.id);
  const progress = (patch) => updateTask(task.id, patch);
  Promise.resolve()
    .then(() => worker(progress))
    .then((result) => finishTask(task.id, { result, status: result?.status }))
    .catch((error) => finishTask(task.id, { status: "FAILED", error: error.message }));
  return task;
}

export async function indexRoutes(app) {
  const repository = new EconomicIndexRepository();
  const requestedBy = (request) => request.headers["x-user-id"] ?? "manual";

  app.get("/", async () => repository.list());

  app.get("/:slug", async (request, reply) => {
    const index = await repository.findOneWithValues(request.params.slug);
    if (!index) return reply.status(404).send({ code: "INDEX_NOT_FOUND", message: "Índice não encontrado." });
    return index;
  });

  app.post("/:slug/refresh", async (request, reply) => {
    const parsed = syncRequestSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ code: "INVALID_SYNC_PERIOD", issues: parsed.error.issues });
    const slug = request.params.slug;
    const env = getEnvironment();
    const task = startBackgroundTask({
      type: "index-refresh",
      label: `Atualizar ${slug} via site`,
      worker: async (onProgress) => {
        const provider = createIndexProvider(env);
        const service = new RefreshEconomicIndexService({ provider, repository });
        return service.execute({ slug, ...parsed.data, requestedBy: requestedBy(request), onProgress });
      },
    });
    return reply.status(202).send({ taskId: task.id, status: task.status });
  });

  app.post("/sync", async (request, reply) => {
    const parsed = syncRequestSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ code: "INVALID_SYNC_PERIOD", issues: parsed.error.issues });
    const env = getEnvironment();
    const task = startBackgroundTask({
      type: "index-sync",
      label: "Atualizar todos os índices",
      worker: async (onProgress) => {
        const provider = createIndexProvider(env);
        const service = new SyncEconomicIndicesService({ provider, repository, targetSlugs });
        return service.execute({ ...parsed.data, requestedBy: requestedBy(request), onProgress });
      },
    });
    return reply.status(202).send({ taskId: task.id, status: task.status });
  });

  app.post("/import", async (request, reply) => {
    const parts = request.parts();
    const fields = { slug: null, name: null, source: null };
    const chunks = [];
    let fileFound = false;

    for await (const part of parts) {
      if (part.type === "file") {
        fileFound = true;
        for await (const chunk of part.file) chunks.push(chunk);
      } else if (part.fieldname in fields) {
        fields[part.fieldname] = String(part.value ?? "").trim() || null;
      }
    }

    if (!fileFound) return reply.status(400).send({ code: "MISSING_FILE", message: "Envie um arquivo PDF para importar o índice." });
    if (chunks.length === 0) return reply.status(400).send({ code: "EMPTY_FILE", message: "O arquivo enviado está vazio." });

    const pdf = Buffer.concat(chunks);
    const task = startBackgroundTask({
      type: "index-import",
      label: `Importar PDF${fields.name ? `: ${fields.name}` : ""}`,
      worker: async (onProgress) => {
        const service = new ImportEconomicIndexService({ repository });
        return service.execute({ ...fields, pdf, requestedBy: requestedBy(request), onProgress });
      },
    });
    return reply.status(202).send({ taskId: task.id, status: task.status });
  });
}
