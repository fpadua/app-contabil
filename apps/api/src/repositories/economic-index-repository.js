import { prisma } from "@contabil/database";

export class EconomicIndexRepository {
  constructor(database = prisma) {
    this.database = database;
  }

  list() {
    return this.database.economicIndex.findMany({
      where: { active: true },
      include: { values: { orderBy: { referenceDate: "desc" }, take: 1 } },
      orderBy: { name: "asc" },
    });
  }

  createSyncRun(data) {
    return this.database.economicIndexSyncRun.create({ data: { ...data, status: "RUNNING" } });
  }

  finishSyncRun(id, data) {
    return this.database.economicIndexSyncRun.update({
      where: { id },
      data: { ...data, finishedAt: new Date() },
    });
  }

  upsertCatalogItem(item) {
    return this.database.economicIndex.upsert({
      where: { slug: item.slug },
      create: { ...item, source: "Debit API" },
      update: { name: item.name, periodicity: item.periodicity, basis: item.basis, active: true },
    });
  }

  async upsertValue({ economicIndexId, syncRunId, value }) {
    return this.database.$transaction(async (transaction) => {
      const key = { economicIndexId_referenceDate: { economicIndexId, referenceDate: value.referenceDate } };
      const existing = await transaction.economicIndexValue.findUnique({ where: key });
      if (!existing) {
        await transaction.economicIndexValue.create({ data: { economicIndexId, ...value, sourceUrl: "https://mcp.debit.com.br/v1" } });
        await transaction.economicIndexValueHistory.create({ data: historyData({ economicIndexId, syncRunId, value }) });
        return "inserted";
      }
      if (sameValue(existing, value)) return "unchanged";
      await transaction.economicIndexValueHistory.create({ data: historyData({ economicIndexId, syncRunId, value, existing }) });
      await transaction.economicIndexValue.update({ where: key, data: { ...value, importedAt: new Date() } });
      return "updated";
    });
  }

  async findMissingPeriods(slug, periods) {
    const index = await this.database.economicIndex.findUnique({
      where: { slug },
      include: { values: { where: { referenceDate: { in: periods }, published: true }, select: { referenceDate: true } } },
    });
    if (!index) return periods;
    const available = new Set(index.values.map((item) => item.referenceDate.toISOString().slice(0, 7)));
    return periods.filter((date) => !available.has(date.toISOString().slice(0, 7)));
  }
}

function sameValue(existing, value) {
  return String(existing.monthlyValue) === String(value.monthlyValue) &&
    String(existing.accumulatedValue) === String(value.accumulatedValue) &&
    String(existing.accumulatedPositive) === String(value.accumulatedPositive) &&
    existing.published === value.published;
}

function historyData({ economicIndexId, syncRunId, value, existing = {} }) {
  return {
    economicIndexId, syncRunId, referenceDate: value.referenceDate,
    previousMonthlyValue: existing.monthlyValue ?? null, newMonthlyValue: value.monthlyValue,
    previousAccumulatedValue: existing.accumulatedValue ?? null, newAccumulatedValue: value.accumulatedValue,
    previousPublished: existing.published ?? null, newPublished: value.published,
  };
}
