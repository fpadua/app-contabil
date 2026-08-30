export class SyncEconomicIndicesService {
  constructor({ provider, repository, targetSlugs }) {
    this.provider = provider;
    this.repository = repository;
    this.targetSlugs = targetSlugs;
  }

  async execute({ from, to, requestedBy = "system" } = {}) {
    const run = await this.repository.createSyncRun({ source: this.provider.sourceName ?? "Economic index provider", requestedBy, fromPeriod: from, toPeriod: to });
    const totals = { inserted: 0, updated: 0, unchanged: 0, failed: 0 };
    const errors = [];

    try {
      const catalog = await this.provider.listIndices();
      const selected = catalog.filter((item) => this.targetSlugs.includes(item.slug));
      const missingSlugs = this.targetSlugs.filter((slug) => !selected.some((item) => item.slug === slug));
      totals.failed += missingSlugs.length;

      for (const item of selected) {
        try {
          const index = await this.repository.upsertCatalogItem(item);
          const series = await this.provider.getSeries(item.slug, { from, to });
          if (series.basis) await this.repository.upsertCatalogItem({ ...item, basis: series.basis });
          for (const value of series.values) {
            const result = await this.repository.upsertValue({ economicIndexId: index.id, syncRunId: run.id, value });
            totals[result] += 1;
          }
        } catch (error) {
          totals.failed += 1;
          errors.push(`${item.slug}: ${error.message}`);
        }
      }

      const status = totals.failed === 0 ? "SUCCEEDED" : totals.inserted + totals.updated + totals.unchanged > 0 ? "PARTIAL" : "FAILED";
      if (missingSlugs.length) errors.push(`Índices ausentes: ${missingSlugs.join(", ")}`);
      await this.repository.finishSyncRun(run.id, { ...totals, status, error: errors.length ? errors.join(" | ").slice(0, 2_000) : null });
      return { syncRunId: run.id, status, ...totals, errors };
    } catch (error) {
      await this.repository.finishSyncRun(run.id, { ...totals, status: "FAILED", failed: totals.failed + 1, error: error.message });
      throw error;
    } finally {
      await this.provider.close?.();
    }
  }
}
