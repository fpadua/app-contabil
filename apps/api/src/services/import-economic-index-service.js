import { PdfIndexParser, PdfIndexImportError } from "./pdf-index-parser.js";

function slugify(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export class ImportEconomicIndexService {
  constructor({ repository, parser = new PdfIndexParser() }) {
    this.repository = repository;
    this.parser = parser;
  }

  async execute({ slug, name, source, pdf, requestedBy = "manual", onProgress }) {
    const report = (progress, message) => onProgress?.({ progress, message, stage: "pdf" });
    report(0, "Lendo arquivo");
    let parsed;
    try {
      parsed = await this.parser.parse(pdf, ({ progress, message }) => report(progress, message));
    } catch (error) {
      if (error instanceof PdfIndexImportError) throw error;
      throw new PdfIndexImportError(`Não foi possível ler o PDF: ${error.message}`);
    }

    if (!parsed.values.length) {
      throw new PdfIndexImportError(
        "O PDF não contém valores reconhecidos. O arquivo deve seguir o modelo do selic.pdf (linhas de meses × colunas de anos).",
      );
    }

    const finalName = (name ?? parsed.name ?? "Índice importado").trim() || "Índice importado";
    const finalSlug = slug ?? (parsed.name ? slugify(parsed.name) : slugify(finalName));
    const finalSource = (source ?? "").trim() || "Importado de PDF";

    const catalogItem = {
      slug: finalSlug,
      name: finalName,
      source: finalSource,
      periodicity: "MONTHLY",
      origin: "IMPORTED",
    };
    report(45, "Registrando índice no catálogo");
    const index = await this.repository.upsertCatalogItem(catalogItem);

    const periods = parsed.values.map((value) => value.referenceDate);
    const fromPeriod = `${periods[0].getUTCFullYear()}-${String(periods[0].getUTCMonth() + 1).padStart(2, "0")}`;
    const toPeriod = `${periods[periods.length - 1].getUTCFullYear()}-${String(periods[periods.length - 1].getUTCMonth() + 1).padStart(2, "0")}`;

    const run = await this.repository.createSyncRun({
      source: `PDF import: ${finalName}`,
      requestedBy,
      fromPeriod,
      toPeriod,
    });

    let totals = { inserted: 0, updated: 0, unchanged: 0, failed: 0 };
    const errors = [];
    try {
      report(50, `Gravando ${parsed.values.length} valores no banco...`);
      totals = await this.repository.importValues({
        economicIndexId: index.id,
        syncRunId: run.id,
        values: parsed.values.map((value) => ({
          referenceDate: value.referenceDate,
          monthlyValue: value.monthlyValue,
          published: true,
          sourceUrl: `import:pdf:${requestedBy}`,
          rawData: { file: requestedBy, cells: value.rawData },
        })),
      });
    } catch (error) {
      totals.failed = parsed.values.length;
      errors.push(error.message);
    }

    const status = totals.failed === 0 && totals.inserted + totals.updated > 0
      ? "SUCCEEDED"
      : totals.inserted + totals.updated > 0 ? "PARTIAL" : "FAILED";
    await this.repository.finishSyncRun(run.id, {
      ...totals,
      status,
      error: errors.length ? errors.join(" | ").slice(0, 2_000) : null,
    });
    report(100, status === "FAILED" ? "Importação falhou" : "Importação concluída");

    return {
      syncRunId: run.id,
      status,
      index: { slug: finalSlug, name: finalName, source: finalSource, origin: "IMPORTED" },
      ...totals,
      errors,
    };
  }
}
