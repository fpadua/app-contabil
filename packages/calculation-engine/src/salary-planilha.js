/**
 * REGRA-DIF-004: grade editável da `Plan 1` (`FONTE-DIF-SALARIAL-001`).
 *
 * Reproduz a cadeia de colunas A..O linha a linha, em precisão cheia, sem
 * arredondamento intermediário — os centavos só aparecem na exibição e na
 * gravação, como o Excel faz ao somar as células.
 *
 * A diferença para a REGRA-DIF-003 é a tolerância: enquanto o usuário digita,
 * células vazias ou inválidas não interrompem a avaliação, apenas assumem o
 * neutro da sua coluna. Assim a planilha pode ser preenchida célula a célula
 * sem travar a cada tecla.
 *
 * Colunas: `A` rótulo, `B` índice de reajuste, `C` valor devido, `D` valor
 * recebido, `E` diferença (`C-D`), `F` índice de atualização, `G` diferença
 * atualizada (`E*F`), `H` juros, `I` valor dos juros (`G*H`), `J` subtotal
 * (`G+I`), `K` taxa Selic, `L` valor da Selic (`J*K`), `M` total (`J+L`) e
 * `O` correção (`G-E`). `N` fica livre, como na planilha de referência.
 */

export const PLANILHA_ROW_KINDS = Object.freeze({
  BASE: "base",
  MONTHLY: "monthly",
  ADJUST: "adjust",
  FRACTION: "fraction",
});

const NEUTRAL_CORRECTION_FACTOR = 1;
const NEUTRAL_RATE = 0;

/**
 * `Number(null)` e `Number("")` valem 0 em JavaScript, o que faria uma célula
 * vazia passar por preenchida. A conversão trata explicitamente a ausência de
 * valor para que a coluna receba o neutro e a validação consiga apontá-la.
 */
function asNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function toPositive(value, fallback) {
  const numeric = asNumber(value);
  return numeric !== null && numeric > 0 ? numeric : fallback;
}

function toRate(value) {
  const numeric = asNumber(value);
  return numeric !== null && numeric >= 0 ? numeric : NEUTRAL_RATE;
}

function isInformedRate(value) {
  const numeric = asNumber(value);
  return numeric !== null && numeric >= 0;
}

function isInformedFactor(value) {
  const numeric = asNumber(value);
  return numeric !== null && numeric > 0;
}

function withFallback(value, fallback) {
  return asNumber(value) === null ? fallback : value;
}

/**
 * `base`: primeira linha da planilha. O valor recebido é o literal informado
 * pelo usuário e a coluna B só reajusta o valor devido, como em `Plan 1!C12`
 * (`=D12*B12+D12`) com `D12` digitado. A partir daí a base vigente passa a ser
 * o par devido/recebido calculado.
 *
 * A base vigente só muda em `base` e `adjust`, como na planilha de referência.
 * Por isso frações e cópias não alimentam o mês seguinte.
 */
function applyRowBase(kind, previousDue, previousReceived, rate) {
  if (kind === PLANILHA_ROW_KINDS.BASE) {
    return { due: previousDue * (1 + rate), received: previousReceived, base: true };
  }
  if (kind === PLANILHA_ROW_KINDS.ADJUST) {
    return { due: previousDue * (1 + rate), received: previousReceived * (1 + rate), base: true };
  }
  if (kind === PLANILHA_ROW_KINDS.FRACTION) {
    return { due: previousDue * rate, received: previousReceived * rate, base: false };
  }
  return { due: previousDue, received: previousReceived, base: false };
}

function normalizeKind(value) {
  return Object.values(PLANILHA_ROW_KINDS).includes(value) ? value : PLANILHA_ROW_KINDS.MONTHLY;
}

/**
 * Avalia a planilha inteira e devolve as células de cada linha, o saldo
 * `I30` e o resumo `I33:I38` com a conferência `N38`.
 */
export function buildSalaryPlanilhaSheet({ baseReceived, rows, defaultSelicRate = 0 } = {}) {
  if (!Array.isArray(rows)) throw new TypeError("rows must be an array");

  const startingBase = toRate(baseReceived);
  let previousDue = startingBase;
  let previousReceived = startingBase;

  const cells = rows.map((row, index) => {
    const kind = normalizeKind(row?.kind);
    const rate = kind === PLANILHA_ROW_KINDS.MONTHLY ? NEUTRAL_RATE : toRate(row?.adjustmentRate);
    const applied = applyRowBase(kind, previousDue, previousReceived, rate);
    if (applied.base) {
      previousDue = applied.due;
      previousReceived = applied.received;
    }

    const due = applied.due;
    const received = applied.received;
    const difference = due - received;
    const correctionFactor = toPositive(row?.correctionFactor, NEUTRAL_CORRECTION_FACTOR);
    const corrected = difference * correctionFactor;
    const interestRate = toRate(row?.interestRate);
    const interest = corrected * interestRate;
    const subtotal = corrected + interest;
    const selicRate = toRate(withFallback(row?.selicRate, defaultSelicRate));
    const selic = subtotal * selicRate;
    const total = subtotal + selic;

    return {
      position: index,
      label: String(row?.label ?? ""),
      kind,
      adjustmentRate: rate,
      due,
      received,
      difference,
      correctionFactor,
      corrected,
      interestRate,
      interest,
      subtotal,
      selicRate,
      selic,
      total,
      correctionOnly: corrected - difference,
      informed: {
        adjustmentRate: kind !== PLANILHA_ROW_KINDS.MONTHLY && isInformedRate(row?.adjustmentRate),
        correctionFactor: isInformedFactor(row?.correctionFactor),
        interestRate: isInformedRate(row?.interestRate),
        selicRate: isInformedRate(row?.selicRate),
      },
    };
  });

  const sum = (field) => cells.reduce((total_, cell) => total_ + cell[field], 0);
  const due = sum("due");
  const received = sum("received");
  const difference = sum("difference");
  const correctionOnly = sum("correctionOnly");
  const interest = sum("interest");
  const selic = sum("selic");
  const corrected = sum("corrected");
  const subtotal = sum("subtotal");
  const sheetTotal = sum("total");
  const payable = due - received + correctionOnly + interest + selic;

  return {
    rows: cells,
    difference,
    sheetTotal,
    payable,
    check: payable - sheetTotal,
    columnTotals: { due, received, difference, corrected, correctionOnly, interest, subtotal, selic, total: sheetTotal },
    totals: { due, received: -received, correctionOnly, interest, selic, payable, sheetTotal },
  };
}

const COMPETENCE_PATTERN = /^(0[1-9]|1[0-2])\/(19|20)\d{2}$/;

/**
 * Lista os impedimentos que impedem a gravação da planilha como cálculo.
 * Cada item aponta a linha da grade para que o usuário localize o erro.
 */
export function findSalaryPlanilhaIssues(sheet, { firstRowNumber = 12 } = {}) {
  const issues = [];
  let hasCompetence = false;

  sheet.rows.forEach((cell, index) => {
    const position = `Linha ${firstRowNumber + index}`;
    if (!cell.label.trim()) {
      issues.push({ position, message: "informe o mês ou o evento na coluna A." });
    } else if (COMPETENCE_PATTERN.test(cell.label.trim())) {
      hasCompetence = true;
    }
    if (cell.kind === PLANILHA_ROW_KINDS.FRACTION && cell.adjustmentRate === 0) {
      issues.push({ position, message: "informe o percentual da fração na coluna B." });
    }
    if (cell.due <= cell.received) {
      issues.push({ position, message: "o valor devido precisa ser maior que o valor recebido." });
    }
    if (!cell.informed.correctionFactor) {
      issues.push({ position, message: "informe o índice de atualização na coluna F." });
    }
  });

  if (!hasCompetence) {
    issues.push({ position: "Coluna A", message: "informe ao menos uma competência no formato MM/AAAA para determinar o período." });
  }
  if (!(sheet.difference > 0)) {
    issues.push({ position: "Resumo", message: "a soma das diferenças precisa ser maior que zero." });
  }
  return issues;
}
