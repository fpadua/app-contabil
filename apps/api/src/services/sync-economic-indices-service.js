export class SyncEconomicIndicesService {
  constructor({ provider, repository, targetSlugs }) {
    this.provider = provider;
    this.repository = repository;
    this.targetSlugs = targetSlugs;
  }

  async execute({ from, to, requestedBy = "system", onProgress } = {}) {
    const run = await this.repository.createSyncRun({ source: this.provider.sourceName ?? "Economic index provider", requestedBy, fromPeriod: from, toPeriod: to });
    const totals = { inserted: 0, updated: 0, unchanged: 0, failed: 0 };
    const errors = [];
    const total = this.targetSlugs.length;

    const report = (patch) => onProgress?.({ step: "sync", ...patch });

    try {
      report({ progress: 0, total, current: 0, currentName: null, message: `Preparando sincronização de ${total} índice${total === 1 ? "" : "s"}...`, stage: "preparando" });

      const catalog = await this.provider.listIndices();
      const availableSlugs = new Set(catalog.map((item) => item.slug));
      for (const slug of this.targetSlugs) {
        if (!availableSlugs.has(slug)) {
          totals.failed += 1;
          errors.push(`Índices ausentes: ${slug}`);
        }
      }

      for (let i = 0; i < total; i += 1) {
        const slug = this.targetSlugs[i];
        const item = catalog.find((c) => c.slug === slug);
        if (!item) {
          report({ current: i + 1, total, currentName: slug, progress: ((i + 1) / total) * 100, message: `${slug} indisponível (${i + 1} de ${total})`, stage: "erro" });
          continue;
        }

        try {
          report({ current: i + 1, total, currentName: item.name, progress: (i / total) * 100, message: `Coletando ${i + 1} de ${total} · ${item.name}...`, stage: "coletando" });
          const index = await this.repository.upsertCatalogItem(item);
          const series = await this.provider.getSeries(slug, { from, to });
          if (series.basis) await this.repository.upsertCatalogItem({ ...item, basis: series.basis });

          report({ current: i + 1, total, currentName: item.name, progress: (i / total) * 100 + 55 / total, message: `Gravando ${series.values.length} valores de ${item.name} (${i + 1} de ${total})...`, stage: "gravando" });
          const imported = await this.repository.importValues({ economicIndexId: index.id, syncRunId: run.id, values: series.values });
          totals.inserted += imported.inserted;
          totals.updated += imported.updated;
          totals.unchanged += imported.unchanged;

          report({ current: i + 1, total, currentName: item.name, progress: ((i + 1) / total) * 100, message: `${item.name} concluído (${i + 1} de ${total})`, stage: "concluido" });
        } catch (error) {
          totals.failed += 1;
          errors.push(`${slug}: ${error.message}`);
          report({ current: i + 1, total, currentName: item.name, progress: ((i + 1) / total) * 100, message: `Falha em ${item.name} (${i + 1} de ${total})`, stage: "erro" });
        }
      }

      const status = totals.failed === 0 ? "SUCCEEDED" : totals.inserted + totals.updated + totals.unchanged > 0 ? "PARTIAL" : "FAILED";
      if (totals.failed > 0 && !errors.some((e) => e.startsWith("Índices ausentes"))) {
        errors.unshift(`Falhas: ${totals.failed}`);
      }
      await this.repository.finishSyncRun(run.id, { ...totals, status, error: errors.length ? errors.join(" | ").slice(0, 2_000) : null });
      report({ progress: 100, current: total, total, stage: "concluido", message: status === "FAILED" ? "Sincronização falhou" : "Sincronização concluída" });
      return { syncRunId: run.id, status, ...totals, errors, indices: this.targetSlugs };
    } catch (error) {
      await this.repository.finishSyncRun(run.id, { ...totals, status: "FAILED", failed: totals.failed + 1, error: error.message });
      report({ progress: 100, current: total, total, stage: "concluido", message: "Sincronização falhou" });
      throw error;
    } finally {
      await this.provider.close?.();
    }
  }
}
