import { z } from "zod";

const uuidParam = z.string().uuid();

export function parseUuidParam(request, reply) {
  const parsed = uuidParam.safeParse(request.params.id);
  if (!parsed.success) {
    reply.status(400).send({ code: "INVALID_ID" });
    return null;
  }
  return parsed.data;
}

export function handleRecordError(reply, error) {
  if (error.code === "P2025") return reply.status(404).send({ code: "NOT_FOUND" });
  throw error;
}