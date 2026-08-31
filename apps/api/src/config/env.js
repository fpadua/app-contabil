import { z } from "zod";

const envSchema = z.object({
  INDEX_PROVIDER: z.enum(["auto", "debit-api", "playwright"]).default("auto"),
  DEBIT_API_URL: z.url().default("https://mcp.debit.com.br/v1"),
  DEBIT_API_KEY: z.preprocess((value) => value === "" ? undefined : value, z.string().min(1).optional()),
  DEBIT_PUBLIC_BASE_URL: z.url().default("https://www.debit.com.br"),
  PLAYWRIGHT_HEADLESS: z.enum(["true", "false"]).default("true").transform((value) => value === "true"),
  PLAYWRIGHT_SCRAPE_DELAY_MS: z.coerce.number().int().min(1_000).max(60_000).default(1_500),
  PLAYWRIGHT_NAVIGATION_TIMEOUT_MS: z.coerce.number().int().min(5_000).max(120_000).default(30_000),
});

export function getEnvironment() {
  return envSchema.parse(process.env);
}
