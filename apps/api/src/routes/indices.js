import { createIndexProvider } from "../providers/index-provider-factory.js";
import { EconomicIndexRepository } from "../repositories/economic-index-repository.js";
import { SyncEconomicIndicesService } from "../services/sync-economic-indices-service.js";
import { getEnvironment } from "../config/env.js";
import { z } from "zod";

const targetSlugs = ["ipca", "ipca_e", "inpc", "igp_m", "tr"];
const syncRequestSchema = z.object({ from: z.string().regex(/^\d{4}-\d{2}$/).optional(), to: z.string().regex(/^\d{4}-\d{2}$/).optional() }).default({});

export async function indexRoutes(app) {
  const repository = new EconomicIndexRepository();

  app.get("/", async () => repository.list());

  app.post("/sync", async (request, reply) => {
    const parsed = syncRequestSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ code: "INVALID_SYNC_PERIOD", issues: parsed.error.issues });
    const env = getEnvironment();
    const provider = createIndexProvider(env);
    const service = new SyncEconomicIndicesService({ provider, repository, targetSlugs });
    const result = await service.execute({ ...parsed.data, requestedBy: request.headers["x-user-id"] ?? "manual" });
    return reply.status(result.status === "FAILED" ? 502 : 200).send(result);
  });
}
