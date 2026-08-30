import Fastify from "fastify";
import cors from "@fastify/cors";
import { calculationRoutes } from "./routes/calculations.js";
import { indexRoutes } from "./routes/indices.js";

const app = Fastify({ logger: true });
await app.register(cors, { origin: process.env.WEB_ORIGIN ?? "http://localhost:3000" });
app.get("/health", async () => ({ status: "ok" }));
await app.register(calculationRoutes, { prefix: "/api/calculations" });
await app.register(indexRoutes, { prefix: "/api/indices" });

try {
  await app.listen({ port: Number(process.env.API_PORT ?? 3333), host: "0.0.0.0" });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
