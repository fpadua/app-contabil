export class IndexCoverageError extends Error {
  constructor(slug, missingPeriods) {
    super(`Missing published values for ${slug}: ${missingPeriods.join(", ")}`);
    this.name = "IndexCoverageError";
    this.code = "MISSING_INDEX_PERIODS";
    this.slug = slug;
    this.missingPeriods = missingPeriods;
  }
}

export async function assertIndexCoverage({ repository, slug, startDate, endDate }) {
  const periods = enumerateMonths(startDate, endDate);
  const missing = await repository.findMissingPeriods(slug, periods);
  if (missing.length) throw new IndexCoverageError(slug, missing.map((date) => date.toISOString().slice(0, 7)));
  return true;
}

export function enumerateMonths(startDate, endDate) {
  const start = new Date(`${startDate.slice(0, 7)}-01T00:00:00.000Z`);
  const end = new Date(`${endDate.slice(0, 7)}-01T00:00:00.000Z`);
  if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf()) || start > end) throw new TypeError("Invalid calculation period");
  const periods = [];
  for (const current = new Date(start); current <= end; current.setUTCMonth(current.getUTCMonth() + 1)) periods.push(new Date(current));
  return periods;
}
