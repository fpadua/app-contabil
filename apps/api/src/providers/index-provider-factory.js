import { DebitIndexProvider } from "./debit-index-provider.js";
import { DebitPlaywrightProvider } from "./debit-playwright-provider.js";

export function createIndexProvider(env) {
  const providerName = env.INDEX_PROVIDER === "auto"
    ? env.DEBIT_API_KEY ? "debit-api" : "playwright"
    : env.INDEX_PROVIDER;

  if (providerName === "debit-api") {
    if (!env.DEBIT_API_KEY) throw new Error("DEBIT_API_KEY é obrigatória quando INDEX_PROVIDER=debit-api");
    const provider = new DebitIndexProvider({ baseUrl: env.DEBIT_API_URL, apiKey: env.DEBIT_API_KEY });
    provider.sourceName = "Debit API";
    return provider;
  }

  return new DebitPlaywrightProvider({
    baseUrl: env.DEBIT_PUBLIC_BASE_URL,
    headless: env.PLAYWRIGHT_HEADLESS,
    delayMs: env.PLAYWRIGHT_SCRAPE_DELAY_MS,
    navigationTimeoutMs: env.PLAYWRIGHT_NAVIGATION_TIMEOUT_MS,
  });
}
