const REQUEST_TIMEOUT_MS = 15_000;

export class DebitIndexProvider {
  constructor({ baseUrl, apiKey, fetchImpl = fetch }) {
    if (!apiKey) throw new Error("DEBIT_API_KEY is required to synchronize economic indices");
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.apiKey = apiKey;
    this.fetchImpl = fetchImpl;
  }

  async listIndices() {
    const payload = await this.#request("/indices");
    const items = payload.data ?? payload.indices ?? payload;
    if (!Array.isArray(items)) throw new Error("Debit API returned an invalid index catalog");
    return items.map(mapCatalogItem);
  }

  async getSeries(slug, { from, to }) {
    const query = new URLSearchParams();
    if (from) query.set("from", from);
    if (to) query.set("to", to);
    const suffix = query.size ? `?${query}` : "";
    const payload = await this.#request(`/indices/${encodeURIComponent(slug)}/series${suffix}`);
    const items = payload.data ?? payload.series ?? payload.values ?? payload;
    if (!Array.isArray(items)) throw new Error(`Debit API returned an invalid series for ${slug}`);
    return { basis: payload.basis ?? null, values: items.map(mapSeriesItem) };
  }

  async #request(path) {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      headers: { Authorization: `Bearer ${this.apiKey}`, Accept: "application/json" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      const retryAfter = response.headers.get("retry-after");
      const suffix = retryAfter ? `; retry after ${retryAfter}s` : "";
      throw new Error(`Debit API request failed with ${response.status}${suffix}`);
    }
    return response.json();
  }
}

function mapCatalogItem(item) {
  return {
    slug: String(item.slug ?? item.id),
    name: String(item.name ?? item.label ?? item.slug ?? item.id),
    periodicity: String(item.periodicity ?? item.frequency ?? "MONTHLY").toUpperCase(),
    basis: item.basis ?? null,
  };
}

function mapSeriesItem(item) {
  const reference = item.reference ?? item.period ?? item.date ?? item.month;
  if (!/^\d{4}-\d{2}/.test(String(reference))) throw new Error(`Invalid series reference: ${reference}`);
  return {
    referenceDate: new Date(`${String(reference).slice(0, 7)}-01T00:00:00.000Z`),
    monthlyValue: toNullableString(item.value ?? item.monthlyValue),
    accumulatedValue: toNullableString(item.accumulated ?? item.accumulatedValue),
    accumulatedPositive: toNullableString(item.accumulatedPositive),
    published: item.published !== false && item.value !== null,
    rawData: item,
  };
}

function toNullableString(value) {
  return value === null || value === undefined || value === "" ? null : String(value);
}
