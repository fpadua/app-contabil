function toFiniteNumber(value, name) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) throw new TypeError(`${name} must be a finite number`);
  return numericValue;
}

function roundCents(value) {
  return Math.round(value);
}

/**
 * REGRA-DIF-003 (parte 1): gera os salários devido/recebido de cada lançamento.
 *
 * Reproduz as colunas B/C/D da `Plan 1` (`FONTE-DIF-SALARIAL-001`):
 * - `monthly`: copia a base salarial vigente (fórmula `=C anterior`).
 * - `adjust`: aplica o índice de reajuste da coluna B à base vigente
 *   (`=anterior * taxa + anterior`), com `dueExtraInCents` opcional para o
 *   ajuste manual de centavos (`+0,01` em `C18`). Coluna B vazia equivale a
 *   `rate: 0`. O resultado vira a nova base vigente.
 * - `copy`: repete a base vigente sem alterá-la (13º salário, `=C16` em `C17`).
 * - `fraction`: fração da base vigente (`C14*20%`, `C20*11,1111%`,
 *   `C25*22,2222%`).
 *
 * A base vigente só muda em `adjust`; por isso lançamentos especiais usam a
 * competência do mês sem herdar o valor da linha anterior.
 */
export function buildSalarySpreadsheetRows({ baseDueInCents, baseReceivedInCents, rows }) {
  const baseDue = toFiniteNumber(baseDueInCents, "baseDueInCents");
  const baseReceived = toFiniteNumber(baseReceivedInCents, "baseReceivedInCents");
  if (!(baseDue > baseReceived)) throw new TypeError("baseDueInCents must be greater than baseReceivedInCents");
  if (!Array.isArray(rows) || rows.length === 0) throw new TypeError("rows must be a non-empty array");

  let monthDue = baseDue;
  let monthReceived = baseReceived;

  return rows.map((row, index) => {
    const position = `row ${index + 1}`;
    if (!row || typeof row.competence !== "string" || row.competence.trim() === "") {
      throw new TypeError(`${position} must have a competence`);
    }
    const rule = row.rule ?? { kind: "monthly" };
    let due = monthDue;
    let received = monthReceived;

    if (rule.kind === "adjust") {
      const rate = toFiniteNumber(rule.rate, `${position} rate`);
      if (rate < 0) throw new TypeError(`${position} rate must be zero or positive`);
      const dueExtra = rule.dueExtraInCents == null ? 0 : toFiniteNumber(rule.dueExtraInCents, `${position} dueExtraInCents`);
      due = monthDue * (1 + rate) + dueExtra;
      received = monthReceived * (1 + rate);
      monthDue = due;
      monthReceived = received;
    } else if (rule.kind === "fraction") {
      const rate = toFiniteNumber(rule.rate, `${position} rate`);
      if (!(rate > 0)) throw new TypeError(`${position} rate must be positive`);
      due = monthDue * rate;
      received = monthReceived * rate;
    } else if (rule.kind !== "monthly" && rule.kind !== "copy") {
      throw new TypeError(`${position} has an unsupported rule kind: ${String(rule.kind)}`);
    }

    if (!(due > received)) throw new TypeError(`${position} must have due greater than received`);
    return {
      competence: row.competence,
      description: row.description ?? "Diferença remuneratória",
      dueInCents: due,
      receivedInCents: received,
    };
  });
}

/**
 * REGRA-DIF-003 (parte 2): aplica a cadeia E→M da `Plan 1` em precisão cheia.
 *
 * Ordem das operações por lançamento, igual à planilha:
 * `E = C - D`; `G = E * F`; `I = G * H`; `J = G + I`; `L = J * K`;
 * `M = J + L`; `O = G - E`.
 *
 * Diferente da REGRA-DIF-002, nada é arredondado no meio do caminho: os
 * valores brutos (`raw*`) alimentam as somas e só viram centavos na
 * conversão final, como o Excel faz ao exibir o somatório das células.
 * Os totais equivalem a `I29` (`SOMA(M12:M28)`) e ao bloco `I32:I37`.
 */
export function calculateSalarySpreadsheet({ rows }) {
  if (!Array.isArray(rows) || rows.length === 0) throw new TypeError("rows must be a non-empty array");

  const months = rows.map((row, index) => {
    const position = `row ${index + 1}`;
    const due = toFiniteNumber(row?.dueInCents, `${position} dueInCents`);
    const received = toFiniteNumber(row?.receivedInCents, `${position} receivedInCents`);
    const correctionFactor = toFiniteNumber(row?.correctionFactor, `${position} correctionFactor`);
    const interestRate = toFiniteNumber(row?.interestRate, `${position} interestRate`);
    const selicRate = toFiniteNumber(row?.selicRate, `${position} selicRate`);
    if (!(due > received)) throw new TypeError(`${position} must have due greater than received`);
    if (!(correctionFactor > 0)) throw new TypeError(`${position} correctionFactor must be positive`);
    if (interestRate < 0 || selicRate < 0) throw new TypeError(`${position} has invalid rates`);

    const rawDifference = due - received;
    const rawCorrected = rawDifference * correctionFactor;
    const rawInterest = rawCorrected * interestRate;
    const rawSubtotal = rawCorrected + rawInterest;
    const rawSelic = rawSubtotal * selicRate;
    const rawTotal = rawSubtotal + rawSelic;

    return {
      competence: row.competence,
      description: row.description ?? "Diferença remuneratória",
      dueInCents: due,
      receivedInCents: received,
      differenceInCents: roundCents(rawDifference),
      correctionFactor,
      correctedInCents: roundCents(rawCorrected),
      correctionOnlyInCents: roundCents(rawCorrected - rawDifference),
      interestRate,
      interestInCents: roundCents(rawInterest),
      subtotalInCents: roundCents(rawSubtotal),
      selicRate,
      selicInCents: roundCents(rawSelic),
      totalInCents: roundCents(rawTotal),
      rawDifference,
      rawCorrected,
      rawInterest,
      rawSubtotal,
      rawSelic,
      rawTotal,
    };
  });

  const sumRaw = (field) => months.reduce((sum, month) => sum + month[field], 0);
  const rawDue = months.reduce((sum, month) => sum + month.dueInCents, 0);
  const rawReceived = months.reduce((sum, month) => sum + month.receivedInCents, 0);
  const rawPrincipal = sumRaw("rawDifference");
  const rawCorrectionOnly = sumRaw("rawCorrected") - rawPrincipal;
  const rawInterest = sumRaw("rawInterest");
  const rawSelic = sumRaw("rawSelic");
  const rawTotal = sumRaw("rawTotal");
  const principalInCents = roundCents(rawPrincipal);
  const totalInCents = roundCents(rawTotal);

  return {
    months,
    principalInCents,
    correctedInCents: totalInCents,
    correctionInCents: totalInCents - principalInCents,
    summary: {
      dueInCents: roundCents(rawDue),
      receivedInCents: roundCents(rawReceived),
      monetaryCorrectionInCents: roundCents(rawCorrectionOnly),
      interestInCents: roundCents(rawInterest),
      selicInCents: roundCents(rawSelic),
    },
    raw: {
      due: rawDue,
      received: rawReceived,
      principal: rawPrincipal,
      monetaryCorrection: rawCorrectionOnly,
      interest: rawInterest,
      selic: rawSelic,
      total: rawTotal,
    },
  };
}
