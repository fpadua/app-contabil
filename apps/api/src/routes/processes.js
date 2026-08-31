import { processCreateSchema, processUpdateSchema } from "../schemas/record-schemas.js";
import { ProcessRepository } from "../repositories/process-repository.js";
import { handleRecordError, parseUuidParam } from "./record-route-helpers.js";

export async function processRoutes(app, { repository = new ProcessRepository() } = {}) {
  app.get("/", async () => repository.list());

  app.get("/options", async () => repository.listOptions());

  app.get("/:id", async (request, reply) => {
    const id = parseUuidParam(request, reply);
    if (!id) return reply;
    const record = await repository.findById(id);
    if (!record) return reply.status(404).send({ code: "NOT_FOUND" });
    return record;
  });

  app.post("/", async (request, reply) => {
    const parsed = processCreateSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ code: "INVALID_PROCESS_INPUT", issues: parsed.error.issues });
    return reply.status(201).send(await repository.create(parsed.data));
  });

  app.put("/:id", async (request, reply) => {
    const id = parseUuidParam(request, reply);
    if (!id) return reply;
    const parsed = processUpdateSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ code: "INVALID_PROCESS_INPUT", issues: parsed.error.issues });
    try {
      return await repository.update(id, parsed.data);
    } catch (error) {
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