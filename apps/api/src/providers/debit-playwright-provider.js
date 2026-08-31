import { chromium } from "playwright";

const INDEX_CATALOG = [
  { slug: "ipca", name: "IPCA (IBGE)", path: "/tabelas/ipca-indice-nacional-de-precos-ao-consumidor-amplo" },
  { slug: "ipca_e", name: "IPCA-E (IBGE)", path: "/tabelas/ipcae-indice-de-precos-ao-consumidor-amplo-especial" },
  { slug: "inpc", name: "INPC (IBGE)", path: "/tabelas/inpc-indice-nacional-de-precos-ao-consumidor" },
  { slug: "igp_m", name: "IGP-M (FGV)", path: "/tabelas/igpm-fgv-indice-geral-de-precos-mercado" },
  { slug: "tr", name: "TR (Bacen)", path: "/tabelas/tr-bacen" },
];

const BLOCK_PAGE_PATTERN = /captcha|access denied|acesso negado|cloudflare|verifique que voc[eê] [eé] humano/i;

export class DebitPlaywrightProvider {
  constructor({
    baseUrl = "https://www.debit.com.br",
    headless = true,
    delayMs = 1_500,
    navigationTimeoutMs = 30_000,
    launchBrowser = (options) => chromium.launch(options),
  } = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.headless = headless;
    this.delayMs = delayMs;
    this.navigationTimeoutMs = navigationTimeoutMs;
    this.launchBrowser = launchBrowser;
    this.browser = null;
    this.lastNavigationAt = 0;
    this.sourceName = "Debit - tabelas públicas (Playwright)";
  }

  async listIndices() {
    return INDEX_CATALOG.map((item) => ({
      slug: item.slug,
      name: item.name,
      periodicity: "MONTHLY",
      basis: {
        monthlyValue: "percent",
        accumulatedValue: "rolling-12-month-percent-when-published",
        sourceUrl: `${this.baseUrl}${item.path}`,
      },
      source: this.sourceName,
    }));
  }

  async getSeries(slug, { from, to } = {}) {
    const index = INDEX_CATALOG.find((item) => item.slug === slug);
    if (!index) throw new Error(`Índice não suportado pelo coletor público: ${slug}`);

    await this.#respectDelay();
    const browser = await this.#getBrowser();
    const page = await browser.newPage({
      locale: "pt-BR",
      userAgent: "app-contabil-index-sync/1.0 (coleta de tabelas públicas)",
    });
    const sourceUrl = `${this.baseUrl}${index.path}`;

    try {
      const response = await page.goto(sourceUrl, { waitUntil: "domcontentloaded", timeout: this.navigationTimeoutMs });
      this.lastNavigationAt = Date.now();
      if (!response?.ok()) throw new Error(`A página pública respondeu com HTTP ${response?.status() ?? "desconhecido"}`);

      const pageText = await page.locator("body").innerText();
      if (BLOCK_PAGE_PATTERN.test(pageText)) {
        throw new Error("A página apresentou um bloqueio de acesso; a rotina não tenta contorná-lo");
      }

      const historicalTable = await findTableByHeaders(page, ["Ano", "Jan", "Dez"]);
      if (!historicalTable) throw new Error("Tabela histórica não encontrada; o layout da página pode ter mudado");

      const expandButton = page.locator("#btnTabelaCompleta").first();
      if (await expandButton.isVisible().catch(() => false)) {
        await expandButton.click();
        const tableHandle = await historicalTable.elementHandle();
        if (tableHandle) {
          await page.waitForFunction(
            (table) => table.querySelectorAll("tbody tr").length > 6,
            tableHandle,
            { timeout: 5_000 },
          ).catch(() => undefined);
        }
      }

      const historicalMatrix = await tableToMatrix(historicalTable);
      const recentTable = await findTableByHeaders(page, ["Data", "Variação", "Acumulado 12 meses"]);
      const recentMatrix = recentTable ? await tableToMatrix(recentTable) : [];
      const values = mergeRecentValues(parseHistoricalTable(historicalMatrix), parseRecentTable(recentMatrix), sourceUrl)
        .filter((item) => isWithinPeriod(item.referenceDate, from, to));

      if (!values.length) throw new Error(`Nenhuma competência encontrada para ${slug} no período solicitado`);
      return {
        basis: {
          monthlyValue: "percent",
          accumulatedValue: "rolling-12-month-percent-when-published",
          sourceUrl,
        },
        values,
      };
    } finally {
      await page.close();
    }
  }

  async close() {
    if (!this.browser) return;
    await this.browser.close();
    this.browser = null;
  }

  async #getBrowser() {
    if (!this.browser) this.browser = await this.launchBrowser({ headless: this.headless });
    return this.browser;
  }

  async #respectDelay() {
    const remaining = this.delayMs - (Date.now() - this.lastNavigationAt);
    if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
  }
}

async function findTableByHeaders(page, expectedHeaders) {
  const tables = page.locator("table");
  for (let index = 0; index < await tables.count(); index += 1) {
    const table = tables.nth(index);
    const headers = (await table.locator("thead th").allTextContents()).map(normalizeText);
    if (expectedHeaders.every((expected) => headers.includes(normalizeText(expected)))) return table;
  }
  return null;
}

async function tableToMatrix(table) {
  const rows = table.locator("tr");
  const matrix = [];
  for (let index = 0; index < await rows.count(); index += 1) {
    const cells = await rows.nth(index).locator("th, td").allTextContents();
    if (cells.length) matrix.push(cells.map((cell) => cell.trim()));
  }
  return matrix;
}

export function parseHistoricalTable(matrix) {
  if (!Array.isArray(matrix) || matrix.length < 2) throw new Error("Tabela histórica vazia ou inválida");
  const headerIndex = matrix.findIndex((row) => normalizeText(row[0]) === "ano");
  if (headerIndex < 0) throw new Error("Cabeçalho 'Ano' não encontrado na tabela histórica");

  const values = [];
  for (const row of matrix.slice(headerIndex + 1)) {
    const year = String(row[0] ?? "").trim();
    if (!/^\d{4}$/.test(year)) continue;
    for (let month = 1; month <= 12; month += 1) {
      const rawValue = String(row[month] ?? "").trim();
      const monthlyValue = parseBrazilianDecimal(rawValue);
      values.push({
        referenceDate: new Date(`${year}-${String(month).padStart(2, "0")}-01T00:00:00.000Z`),
        monthlyValue,
        accumulatedValue: null,
        accumulatedPositive: null,
        published: monthlyValue !== null,
        rawData: { historicalCell: rawValue },
      });
    }
  }
  return values.sort((left, right) => left.referenceDate - right.referenceDate);
}

export function parseRecentTable(matrix) {
  if (!Array.isArray(matrix) || matrix.length < 2) return new Map();
  const headerIndex = matrix.findIndex((row) => normalizeText(row[0]) === "data");
  if (headerIndex < 0) return new Map();
  const headers = matrix[headerIndex].map(normalizeText);
  const variationIndex = headers.indexOf("variacao");
  const accumulatedIndex = headers.indexOf("acumulado 12 meses");
  const result = new Map();

  for (const row of matrix.slice(headerIndex + 1)) {
    const match = String(row[0] ?? "").trim().match(/^(\d{2})\/(\d{4})$/);
    if (!match) continue;
    const period = `${match[2]}-${match[1]}`;
    result.set(period, {
      monthlyValue: parseBrazilianDecimal(row[variationIndex]),
      accumulatedValue: parseBrazilianDecimal(row[accumulatedIndex]),
      rawData: { recentRow: row },
    });
  }
  return result;
}

export function parseBrazilianDecimal(value) {
  const text = String(value ?? "").replace(/[%\s\u00a0]/g, "").trim();
  if (!text || /^[-–—]$/.test(text)) return null;
  const normalized = text.includes(",") ? text.replace(/\./g, "").replace(",", ".") : text;
  if (!/^[+-]?\d+(?:\.\d+)?$/.test(normalized)) throw new Error(`Valor numérico inválido: ${value}`);
  return normalized.replace(/^\+/, "");
}

function mergeRecentValues(historicalValues, recentValues, sourceUrl) {
  return historicalValues.map((item) => {
    const period = item.referenceDate.toISOString().slice(0, 7);
    const recent = recentValues.get(period);
    return {
      ...item,
      monthlyValue: recent?.monthlyValue ?? item.monthlyValue,
      accumulatedValue: recent?.accumulatedValue ?? null,
      published: (recent?.monthlyValue ?? item.monthlyValue) !== null,
      sourceUrl,
      rawData: { ...item.rawData, ...recent?.rawData, sourceUrl },
    };
  });
}

function isWithinPeriod(referenceDate, from, to) {
  const period = referenceDate.toISOString().slice(0, 7);
  return (!from || period >= from) && (!to || period <= to);
}

function normalizeText(value) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}
