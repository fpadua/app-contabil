import { prisma } from "@contabil/database";

export class EconomicIndexRepository {
  constructor(database = prisma) {
    this.database = database;
  }

  list() {
    return this.database.economicIndex.findMany({
      where: { active: true },
      include: { values: { where: { published: true }, orderBy: { referenceDate: "desc" }, take: 1 } },
      orderBy: { name: "asc" },
    });
  }

  findBySlug(slug) {
    return this.database.economicIndex.findUnique({ where: { slug } });
  }

  findOneWithValues(slug) {
    return this.database.economicIndex.findUnique({
      where: { slug },
      include: { values: { orderBy: { referenceDate: "asc" } } },
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
      create: { slug: item.slug, name: item.name, source: item.source ?? "Debit API", periodicity: item.periodicity, basis: item.basis, origin: item.origin ?? "SYNCED" },
      update: { name: item.name, source: item.source ?? "Debit API", periodicity: item.periodicity, basis: item.basis, origin: item.origin ?? "SYNCED", active: true },
    });
  }

  async upsertValue({ economicIndexId, syncRunId, value }) {
    return this.database.$transaction((transaction) => upsertOneValue(transaction, { economicIndexId, syncRunId, value }));
  }

  async importValues({ economicIndexId, syncRunId, values }) {
    const existingRows = await this.database.economicIndexValue.findMany({
      where: { economicIndexId },
      select: { referenceDate: true, monthlyValue: true, accumulatedValue: true, accumulatedPositive: true, published: true },
    });
    const existingByPeriod = new Map(existingRows.map((row) => [row.referenceDate.toISOString().slice(0, 7), row]));

    const toCreate = [];
    const toUpdate = [];
    const createHistory = [];
    const updateHistory = [];
    let unchanged = 0;

    for (const value of values) {
      const key = value.referenceDate.toISOString().slice(0, 7);
      const existing = existingByPeriod.get(key);
      if (!existing) {
        toCreate.push({ economicIndexId, ...value, sourceUrl: value.sourceUrl ?? "https://mcp.debit.com.br/v1" });
        createHistory.push(historyData({ economicIndexId, syncRunId, value }));
      } else if (sameValue(existing, value)) {
        unchanged += 1;
      } else {
        toUpdate.push(value);
        updateHistory.push(historyData({ economicIndexId, syncRunId, value, existing }));
      }
    }

    if (toCreate.length) {
      await this.database.economicIndexValue.createMany({ data: toCreate, skipDuplicates: true });
      await this.database.economicIndexValueHistory.createMany({ data: createHistory });
    }
    for (const value of toUpdate) {
      await this.database.economicIndexValue.update({
        where: { economicIndexId_referenceDate: { economicIndexId, referenceDate: value.referenceDate } },
        data: { ...value, importedAt: new Date() },
      });
    }
    if (updateHistory.length) {
      await this.database.economicIndexValueHistory.createMany({ data: updateHistory });
    }

    return { inserted: toCreate.length, updated: toUpdate.length, unchanged, failed: 0 };
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

  findValuesBetween(slug, fromPeriod, toPeriod) {
    return this.database.economicIndex.findUnique({
      where: { slug },
      select: {
        values: {
          where: { referenceDate: { gte: fromPeriod, lte: toPeriod }, published: true },
          orderBy: { referenceDate: "asc" },
          select: { referenceDate: true, monthlyValue: true, accumulatedPositive: true },
        },
      },
    });
  }
}

function upsertOneValue(transaction, { economicIndexId, syncRunId, value }) {
  const key = { economicIndexId_referenceDate: { economicIndexId, referenceDate: value.referenceDate } };
  return transaction.economicIndexValue.findUnique({ where: key })
    .then((existing) => {
      if (!existing) {
        return transaction.economicIndexValue.create({ data: { economicIndexId, ...value, sourceUrl: value.sourceUrl ?? "https://mcp.debit.com.br/v1" } })
          .then(() => transaction.economicIndexValueHistory.create({ data: historyData({ economicIndexId, syncRunId, value }) }))
          .then(() => "inserted");
      }
      if (sameValue(existing, value)) return "unchanged";
      return transaction.economicIndexValueHistory.create({ data: historyData({ economicIndexId, syncRunId, value, existing }) })
        .then(() => transaction.economicIndexValue.update({ where: key, data: { ...value, importedAt: new Date() } }))
        .then(() => "updated");
    });
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
