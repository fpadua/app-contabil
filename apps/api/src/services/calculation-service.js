import {
  accumulateSeriesFactors,
  applyAccumulatedFactor,
  judicialTwoPhaseCorrection,
  priceIndexedSchedule,
  priceSchedule,
  sacIndexedSchedule,
  sacSchedule,
  salaryDifferenceSchedule,
} from "@contabil/calculation-engine";
import { EconomicIndexRepository } from "../repositories/economic-index-repository.js";
import { assertIndexCoverage } from "./index-coverage-service.js";

const SELIC_CUTOVER = new Date("2021-11-30T23:59:59.999Z");
const JUDICIAL_FIRST_PHASE_INDEX = "ipca_e";

export async function calculateMonetaryCorrection(input, repository = new EconomicIndexRepository()) {
  if (input.periods && !input.accumulatedFactor) {
    return calculateMonetaryByPeriods(input, repository);
  }
  await assertIndexCoverage({ repository, slug: input.indexSlug, startDate: input.startDate, endDate: input.endDate });

  const accumulation = input.accumulatedFactor ? { accumulatedFactor: input.accumulatedFactor, months: null } : await buildAccumulation(input, repository);

  const correctedInCents = applyAccumulatedFactor(input.principalInCents, accumulation.accumulatedFactor);
  return {
    type: "monetary",
    principalInCents: input.principalInCents,
    indexSlug: input.indexSlug,
    startDate: input.startDate,
    endDate: input.endDate,
    accumulatedFactor: accumulation.accumulatedFactor,
    correctedInCents,
    correctionInCents: correctedInCents - input.principalInCents,
    traceabilityRuleId: "REGRA-CM-001",
    months: accumulation.months,
  };
}

async function calculateMonetaryByPeriods(input, repository) {
  const sorted = [...input.periods].sort((a, b) => a.startDate.localeCompare(b.startDate));
  let runningFactor = 1;
  let months = [];
  for (const period of sorted) {
    await assertIndexCoverage({ repository, slug: period.indexSlug, startDate: period.startDate, endDate: period.endDate });
    const segment = await buildAccumulation({ principalInCents: input.principalInCents, indexSlug: period.indexSlug, startDate: period.startDate, endDate: period.endDate }, repository);
    const segmentStart = runningFactor;
    runningFactor *= segment.accumulatedFactor;
    months = months.concat((segment.months ?? []).map((month) => ({
      referenceDate: month.referenceDate,
      competence: month.competence,
      factor: month.factor,
      accumulatedFactor: segmentStart * month.accumulatedFactor,
      correctedInCents: applyAccumulatedFactor(input.principalInCents, segmentStart * month.accumulatedFactor),
    })));
  }

  const correctedInCents = applyAccumulatedFactor(input.principalInCents, runningFactor);
  return {
    type: "monetary",
    principalInCents: input.principalInCents,
    indexSlug: input.indexSlug,
    startDate: input.startDate,
    endDate: input.endDate,
    accumulatedFactor: runningFactor,
    correctedInCents,
    correctionInCents: correctedInCents - input.principalInCents,
    traceabilityRuleId: "REGRA-CM-001",
    months,
  };
}

export async function calculateSac(input, repository = new EconomicIndexRepository()) {
  const { principalInCents, monthlyInterestRate, months, startDate, endDate } = input;
  let traceabilityRuleId = "REGRA-SAC-001";
  let accumulatedFactor = 1;
  let installments;

  if (input.indexSlug) {
    if (input.indexSlug === "tr") traceabilityRuleId = "REGRA-SAC-002";
    await assertIndexCoverage({ repository, slug: input.indexSlug, startDate, endDate });
    const stats = await loadMonthlyStats({ repository, slug: input.indexSlug, startDate, endDate });
    const capped = stats.slice(0, months);
    installments = sacIndexedSchedule({ principalInCents, monthlyInterestRate, monthlyStats: capped });
    accumulatedFactor = seriesAccumulatedFactor(capped);
  } else {
    installments = sacSchedule({ principalInCents, monthlyInterestRate, months });
  }

  const correctedInCents = installments.reduce((sum, row) => sum + row.installmentInCents, 0);
  return {
    type: "sac",
    principalInCents,
    indexSlug: input.indexSlug ?? null,
    startDate,
    endDate,
    accumulatedFactor,
    correctedInCents,
    correctionInCents: correctedInCents - principalInCents,
    traceabilityRuleId,
    installments,
  };
}

export async function calculatePrice(input, repository = new EconomicIndexRepository()) {
  const { principalInCents, monthlyInterestRate, months, startDate, endDate } = input;
  let accumulatedFactor = 1;
  let installments;

  if (input.indexSlug) {
    await assertIndexCoverage({ repository, slug: input.indexSlug, startDate, endDate });
    const stats = await loadMonthlyStats({ repository, slug: input.indexSlug, startDate, endDate });
    const capped = stats.slice(0, months);
    installments = priceIndexedSchedule({ principalInCents, monthlyInterestRate, monthlyStats: capped });
    accumulatedFactor = seriesAccumulatedFactor(capped);
  } else {
    installments = priceSchedule({ principalInCents, monthlyInterestRate, months });
  }

  const correctedInCents = installments.reduce((sum, row) => sum + row.installmentInCents, 0);
  return {
    type: "price",
    principalInCents,
    indexSlug: input.indexSlug ?? null,
    startDate,
    endDate,
    accumulatedFactor,
    correctedInCents,
    correctionInCents: correctedInCents - principalInCents,
    traceabilityRuleId: "REGRA-PRICE-001",
    installments,
  };
}

export async function calculateSalaryDifference(input, repository = new EconomicIndexRepository()) {
  const indexSlug = input.indexSlug ?? "ipca_e";
  const { startDate, endDate } = input;
  await assertIndexCoverage({ repository, slug: indexSlug, startDate, endDate });
  const stats = await loadMonthlyStats({ repository, slug: indexSlug, startDate, endDate });
  const monthlyDifferenceInCents = input.salaryNewInCents - input.salaryPreviousInCents;
  const schedule = salaryDifferenceSchedule({
    monthlyDifferenceInCents,
    monthlyStats: stats,
    reflections: { decimoTerceiro: input.decimoTerceiro ?? true, vacationsWithBonus: input.vacationsWithBonus ?? true },
  });

  return {
    type: "salary",
    principalInCents: monthlyDifferenceInCents,
    indexSlug,
    startDate,
    endDate,
    accumulatedFactor: schedule.accumulatedFactor,
    correctedInCents: schedule.correctedInCents,
    correctionInCents: schedule.correctionInCents,
    traceabilityRuleId: "REGRA-DIF-001",
    months: schedule.months,
    params: schedule.params,
  };
}

export async function calculateJudicialCorrection(input, repository = new EconomicIndexRepository()) {
  const { principalInCents, startDate, endDate } = input;
  const stats = await loadMonthlyStats({ repository, slug: JUDICIAL_FIRST_PHASE_INDEX, startDate, endDate: phaseOneEndDate(startDate, endDate) });
  const firstPhaseStats = stats.filter((item) => new Date(item.referenceDate) <= SELIC_CUTOVER);

  if (!firstPhaseStats.length) {
    throw Object.assign(new Error("O período informado está integralmente na fase Selic. Informe o fator acumulado da fase Selic."), { code: "JUDICIAL_NO_FIRST_PHASE" });
  }

  let secondPhaseAccumulatedFactor = input.selicAccumulatedFactor;
  if (!secondPhaseAccumulatedFactor) {
    const selic = await loadSelicSecondPhase(repository, new Date(startDate), new Date(endDate));
    if (!selic.length) {
      throw Object.assign(new Error("Informe o fator acumulado da fase Selic (a partir de 09/12/2021) ou sincronize a série oficial antes."), { code: "JUDICIAL_NO_SELIC" });
    }
    secondPhaseAccumulatedFactor = seriesAccumulatedFactor(selic);
  }

  const result = judicialTwoPhaseCorrection({ principalInCents, firstPhaseStats, secondPhaseAccumulatedFactor });
  return {
    type: "judicial",
    principalInCents,
    indexSlug: JUDICIAL_FIRST_PHASE_INDEX,
    startDate,
    endDate,
    accumulatedFactor: result.accumulatedFactor,
    correctedInCents: result.correctedInCents,
    correctionInCents: result.correctionInCents,
    traceabilityRuleId: "REGRA-JUD-001",
    months: result.months,
  };
}

async function buildAccumulation(input, repository) {
  const from = new Date(`${input.startDate.slice(0, 7)}-01T00:00:00.000Z`);
  const to = new Date(`${input.endDate.slice(0, 7)}-01T00:00:00.000Z`);
  const found = await repository.findValuesBetween(input.indexSlug, from, to);
  const values = found?.values ?? [];
  if (!values.length) throw new Error(`Nenhuma competência disponível para ${input.indexSlug} no período solicitado.`);

  const factors = values.map((item) => ({ referenceDate: item.referenceDate, factor: toFactor(item.accumulatedPositive, item.monthlyValue) }));
  const { accumulatedFactor, perMonth } = accumulateSeriesFactors(factors);

  return {
    accumulatedFactor,
    months: perMonth.map((month) => ({
      referenceDate: month.referenceDate,
      competence: formatCompetence(month.referenceDate),
      factor: month.factor,
      accumulatedFactor: month.accumulatedFactor,
      correctedInCents: applyAccumulatedFactor(input.principalInCents, month.accumulatedFactor),
    })),
  };
}

async function loadMonthlyStats({ repository, slug, startDate, endDate }) {
  const from = new Date(`${startDate.slice(0, 7)}-01T00:00:00.000Z`);
  const to = new Date(`${endDate.slice(0, 7)}-01T00:00:00.000Z`);
  const found = await repository.findValuesBetween(slug, from, to);
  const values = found?.values ?? [];
  if (!values.length) throw new Error(`Nenhuma competência disponível para ${slug} no período solicitado.`);
  return values.map((item) => ({ referenceDate: item.referenceDate, factor: toFactor(item.accumulatedPositive, item.monthlyValue) }));
}

async function loadSelicSecondPhase(repository, from, to) {
  const found = await repository.findValuesBetween("selic", from, to);
  const values = (found?.values ?? []).filter((item) => new Date(item.referenceDate) > SELIC_CUTOVER);
  return values.map((item) => ({ referenceDate: item.referenceDate, factor: toFactor(item.accumulatedPositive, item.monthlyValue) }));
}

function phaseOneEndDate(startDate, endDate) {
  const end = new Date(`${endDate.slice(0, 7)}-01T00:00:00.000Z`);
  if (end <= SELIC_CUTOVER) return endDate;
  return "2021-11";
}

function seriesAccumulatedFactor(stats) {
  if (!stats.length) return 1;
  const { accumulatedFactor } = accumulateSeriesFactors(stats);
  return accumulatedFactor;
}

function toFactor(accumulatedPositive, monthlyValue) {
  const positive = Number(accumulatedPositive);
  if (Number.isFinite(positive) && positive > 0) return positive;
  const rate = Number(monthlyValue ?? 0);
  return 1 + (Number.isFinite(rate) ? rate / 100 : 0);
}

function formatCompetence(value) {
  const date = new Date(value);
  return `${String(date.getUTCMonth() + 1).padStart(2, "0")}/${date.getUTCFullYear()}`;
}