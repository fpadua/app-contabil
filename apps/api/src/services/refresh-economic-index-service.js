export class RefreshEconomicIndexService {
  constructor({ repository, provider }) {
    this.repository = repository;
    this.provider = provider;
  }

  async execute({ slug, from, to, requestedBy = "manual", onProgress }) {
    const report = (progress, message) => onProgress?.({ progress, message, stage: "site" });
    report(0, "Iniciando atualização");
    const run = await this.repository.createSyncRun({
      source: this.provider.sourceName ?? "Economic index provider",
      requestedBy,
      fromPeriod: from,
      toPeriod: to,
    });
    const totals = { inserted: 0, updated: 0, unchanged: 0, failed: 0 };
    const errors = [];
    let indexName;

    try {
      const index = await this.repository.findBySlug(slug);
      if (!index) {
        totals.failed = 1;
        errors.push(`Índice '${slug}' não encontrado`);
      } else {
        indexName = index.name;
        report(4, "Carregando índice");
        const series = await this.provider.getSeries(slug, {
          from,
          to,
          onProgress: ({ progress, message }) => report(4 + Math.round((progress / 100) * 80), message),
        });
        if (series.basis) await this.repository.upsertCatalogItem({ ...index, basis: series.basis });
        report(86, "Gravando valores no banco...");
        const imported = await this.repository.importValues({
          economicIndexId: index.id,
          syncRunId: run.id,
          values: series.values.map((value) => ({ ...value, published: value.published ?? true })),
        });
        totals.inserted = imported.inserted;
        totals.updated = imported.updated;
        totals.unchanged = imported.unchanged;
        report(97, "Finalizando");
      }

      const status = totals.failed === 0 && totals.inserted + totals.updated > 0
        ? "SUCCEEDED"
        : totals.inserted + totals.updated > 0 ? "PARTIAL" : "FAILED";
      await this.repository.finishSyncRun(run.id, { ...totals, status, error: errors.length ? errors.join(" | ").slice(0, 2_000) : null });
      report(100, status === "FAILED" ? "Atualização falhou" : "Atualização concluída");
      return { syncRunId: run.id, status, index: { slug, name: indexName }, ...totals, errors };
    } catch (error) {
      await this.repository.finishSyncRun(run.id, { ...totals, status: "FAILED", failed: totals.failed + 1, error: error.message });
      report(100, "Atualização falhou");
      return { syncRunId: run.id, status: "FAILED", index: { slug, name: indexName }, ...totals, errors: [error.message] };
    } finally {
      await this.provider.close?.();
    }
  }
}
