import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";
import { existsSync } from "node:fs";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf.mjs";

const MONTHS = {
  jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6,
  jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12,
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKER_PATH = findWorkerPath();

function findWorkerPath() {
  const candidates = [
    resolve(__dirname, "../../../../node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"),
    resolve(__dirname, "../../../node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"),
    resolve(__dirname, "../../node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"),
  ];
  for (const candidate of candidates) {
    try {
      if (existsSync(candidate)) return pathToFileURL(candidate).href;
    } catch {}
  }
  return candidates[0];
}

export class PdfIndexImportError extends Error {
  constructor(message, code = "INVALID_PDF_INDEX") {
    super(message);
    this.name = "PdfIndexImportError";
    this.code = code;
  }
}

export class PdfIndexParser {
  constructor({ pdfjsGetDocument = getDocument, maxPages = 100 } = {}) {
    this.getDocument = pdfjsGetDocument;
    this.maxPages = maxPages;
  }

  async parse(buffer, onProgress) {
    if (!(buffer instanceof Uint8Array) || buffer.length === 0) {
      throw new PdfIndexImportError("Arquivo PDF vazio.", "EMPTY_FILE");
    }
    GlobalWorkerOptions.workerSrc = WORKER_PATH;
    const loadingTask = this.getDocument({
      data: new Uint8Array(buffer),
      useWorkerFetch: false,
      isEvalSupported: false,
    });

    let doc;
    try {
      doc = await loadingTask.promise;
    } catch (error) {
      throw new PdfIndexImportError(`Não foi possível abrir o PDF: ${error.message}`, "INVALID_PDF_FILE");
    }

    let inferredName = null;
    const cells = [];
    try {
      const pageCount = Math.min(doc.numPages, this.maxPages);
      onProgress?.({ progress: 5, message: `Lendo PDF (${doc.numPages} página${doc.numPages === 1 ? "" : "s"})` });
      for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
        const page = await doc.getPage(pageNumber);
        const content = await page.getTextContent();
        const items = content.items
          .filter((item) => typeof item.str === "string" && item.str.trim().length > 0)
          .map((item) => ({
            text: item.str.trim(),
            x: item.transform[4],
            y: item.transform[5],
          }));

        const { name, rows } = this.#extractPage(items, pageNumber);
        inferredName = name ?? inferredName;
        cells.push(...rows);
        onProgress?.({ progress: 5 + Math.round((pageNumber / pageCount) * 35), message: `Extraindo tabela (página ${pageNumber} de ${pageCount})` });
      }
    } finally {
      await loadingTask.destroy().catch(() => {});
    }

    onProgress?.({ progress: 42, message: "PDF interpretado" });
    return { name: inferredName, values: this.#toValues(cells) };
  }

  #extractPage(items, pageNumber) {
    if (items.length < 3) return { name: null, rows: [] };

    const rowsByY = groupBy(items, (item) => round(item.y));
    const yLevels = Object.keys(rowsByY).map(Number).sort((a, b) => b - a);

    let headerRow = null;
    let inferredName = null;
    for (const y of yLevels) {
      const rowItems = rowsByY[y].sort((a, b) => a.x - b.x);
      const years = rowItems.filter((item) => /^\d{4}$/.test(item.text));
      const headerCandidate = years.filter((yearItem) => {
        const isMonthRow = rowItems.some((item) => MONTHS[item.text.toLowerCase()]);
        return !isMonthRow;
      });
      if (headerCandidate.length >= 1) {
        headerRow = { y, items: rowItems, years: headerCandidate };
        break;
      }
      if (!inferredName) inferredName = rowItems.map((item) => item.text).join(" ");
    }

    if (!headerRow) {
      throw new PdfIndexImportError(
        `Não encontrei a linha de anos (cabeçalho) na página ${pageNumber}.`,
        "MISSING_YEAR_HEADER"
      );
    }

    const yearColumns = headerRow.years.map((item) => ({ year: Number(item.text), x: item.x }));
    const rows = [];
    for (const y of yLevels) {
      if (y === headerRow.y) continue;
      const rowItems = rowsByY[y].sort((a, b) => a.x - b.x);
      const monthText = rowItems[0]?.text.toLowerCase();
      const month = MONTHS[monthText];
      if (!month) continue;

      const values = rowItems.slice(1).filter((item) => isNumeric(item.text));
      for (const cell of values) {
        const column = nearestYearColumn(yearColumns, cell.x);
        const value = parseNumber(cell.text);
        const referenceDate = new Date(Date.UTC(column.year, month - 1, 1));
        rows.push({ referenceDate, monthlyValue: value, sourceCell: cell.text, sourceYear: column.year });
      }
    }
    return { name: inferredName, rows };
  }

  #toValues(rows) {
    const byPeriod = new Map();
    for (const row of rows) {
      const key = row.referenceDate.toISOString().slice(0, 7);
      const existing = byPeriod.get(key);
      if (!existing) {
        byPeriod.set(key, { ...row, rawData: [{ value: row.sourceCell, year: row.sourceYear }] });
      } else if (existing.sourceYear === row.sourceYear) {
        existing.rawData.push({ value: row.sourceCell, year: row.sourceYear });
      }
    }
    const values = Array.from(byPeriod.values());
    values.sort((a, b) => a.referenceDate - b.referenceDate);
    return values;
  }
}

function groupBy(items, keyOf) {
  const map = {};
  for (const item of items) {
    const key = keyOf(item);
    (map[key] ??= []).push(item);
  }
  return map;
}

function round(value) {
  return Math.round(value * 10) / 10;
}

function nearestYearColumn(columns, x) {
  let best = columns[0];
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const column of columns) {
    const distance = Math.abs(column.x - x);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = column;
    }
  }
  return best;
}

function isNumeric(text) {
  return /^-?\d{1,3}(\.\d{3})*(,\d+)?$/.test(text);
}

function parseNumber(text) {
  return text.replace(/\./g, "").replace(",", ".");
}
