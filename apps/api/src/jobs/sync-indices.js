import { getEnvironment } from "../config/env.js";
import { DebitIndexProvider } from "../providers/debit-index-provider.js";
import { EconomicIndexRepository } from "../repositories/economic-index-repository.js";
import { SyncEconomicIndicesService } from "../services/sync-economic-indices-service.js";

const env = getEnvironment();
const provider = new DebitIndexProvider({ baseUrl: env.DEBIT_API_URL, apiKey: env.DEBIT_API_KEY });
const repository = new EconomicIndexRepository();
const service = new SyncEconomicIndicesService({ provider, repository, targetSlugs: ["ipca", "ipca_e", "inpc", "igp_m", "tr"] });
const to = new Date().toISOString().slice(0, 7);
const fromDate = new Date();
fromDate.setUTCMonth(fromDate.getUTCMonth() - 5);
const from = fromDate.toISOString().slice(0, 7);

try {
  const result = await service.execute({ from, to, requestedBy: "scheduled-job" });
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (result.status === "FAILED") process.exitCode = 1;
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
