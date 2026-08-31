import "./config/load-environment.js";
import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { calculationRoutes } from "./routes/calculations.js";
import { indexRoutes } from "./routes/indices.js";
import { taskRoutes } from "./routes/tasks.js";
import { clientRoutes } from "./routes/clients.js";
import { processRoutes } from "./routes/processes.js";
import { documentRoutes } from "./routes/documents.js";

const app = Fastify({ logger: true });
await app.register(cors, {
  origin: process.env.WEB_ORIGIN ?? "http://localhost:3000",
  methods: ["GET", "HEAD", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
});
await app.register(multipart, { limits: { files: 1, fileSize: 10 * 1024 * 1024 } });
app.get("/health", async () => ({ status: "ok" }));
await app.register(calculationRoutes, { prefix: "/api/calculations" });
await app.register(indexRoutes, { prefix: "/api/indices" });
await app.register(taskRoutes, { prefix: "/api/tasks" });
await app.register(clientRoutes, { prefix: "/api/clients" });
await app.register(processRoutes, { prefix: "/api/processes" });
await app.register(documentRoutes, { prefix: "/api/documents" });

try {
  await app.listen({ port: Number(process.env.API_PORT ?? 3333), host: "0.0.0.0" });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
