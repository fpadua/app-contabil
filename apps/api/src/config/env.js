import { z } from "zod";

const envSchema = z.object({
  DEBIT_API_URL: z.url().default("https://mcp.debit.com.br/v1"),
  DEBIT_API_KEY: z.string().min(1).optional(),
});

export function getEnvironment() {
  return envSchema.parse(process.env);
}
