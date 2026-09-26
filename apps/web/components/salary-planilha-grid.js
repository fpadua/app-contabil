"use client";

import { Copy, Plus, Trash2 } from "lucide-react";
import { PLANILHA_COLUMNS, PLANILHA_ROW_KIND_OPTIONS, formatPlanilhaCell, maskPlanilhaCompetence, maskPlanilhaDecimal, rowNumberAt } from "../lib/planilha";

const GUTTER_WIDTH = 40;
const KIND_WIDTH = 132;
const ACTIONS_WIDTH = 96;
const TABLE_WIDTH = GUTTER_WIDTH + KIND_WIDTH + ACTIONS_WIDTH + PLANILHA_COLUMNS.reduce((sum, column) => sum + column.width, 0);

const KIND_OPTIONS_AFTER_FIRST_ROW = PLANILHA_ROW_KIND_OPTIONS.filter((option) => option.value !== "base");

function kindOptions(index) {
  return index === 0 ? PLANILHA_ROW_KIND_OPTIONS : KIND_OPTIONS_AFTER_FIRST_ROW;
}

function rowKindHint(kind) {
  return PLANILHA_ROW_KIND_OPTIONS.find((option) => option.value === kind)?.hint ?? "";
}

/**
 * Reproduz a grade da `Plan 1`: gutter com o número da linha, letras das colunas
 * e células de entrada em azul, como o Excel marca o que foi digitado. As
 * fórmulas ficam ocultas — C, D, E, G, I, J, L, M e O mostram apenas o
 * resultado. A coluna Regra é o único acréscimo: ela escolhe qual fórmula
 * fechada de C e D a linha usa, já que a fórmula em si não aparece.
 */
export function SalaryPlanilhaGrid({ sheet, evaluation, onChange, onRowAdd, onRowDuplicate, onRowRemove, readOnly = false }) {
  const updateRow = (index, field, value) => {
    onChange(sheet.rows.map((row, current) => (current === index ? { ...row, [field]: value } : row)));
  };

  return <div className="planilha-scroll" role="region" aria-label="Grade de cálculo das diferenças remuneratórias" tabIndex={0}>
    <table className="planilha" style={{ width: `${TABLE_WIDTH}px` }}>
      <thead>
        <tr>
          <th className="planilha-gutter planilha-gutter-head" scope="col" />
          <th className="planilha-kind-head" scope="col">Regra</th>
          {PLANILHA_COLUMNS.map((column) => <th className={column.role === "spacer" ? "planilha-spacer" : "planilha-col-head"} key={column.letter} scope="col">
            {column.label && <span className="planilha-title">{column.label}</span>}
          </th>)}
          <th className="planilha-actions-head" scope="col">Ações</th>
        </tr>
      </thead>
      <tbody>
        {sheet.rows.map((row, index) => {
          const rowNumber = rowNumberAt(index);
          return <tr key={row.id}>
            <td className="planilha-gutter">{rowNumber}</td>
            <th className="planilha-kind" scope="row">
              <select
                aria-label={`Regra da linha ${rowNumber}`}
                disabled={readOnly}
                onChange={(event) => updateRow(index, "kind", event.target.value)}
                title={rowKindHint(row.kind)}
                value={row.kind}
              >
                {kindOptions(index).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </th>
            {PLANILHA_COLUMNS.map((column) => <Cell
              cell={evaluation.rows[index]}
              column={column}
              disabled={readOnly}
              key={column.letter}
              onChange={(value) => updateRow(index, column.key, value)}
              row={row}
              rowNumber={rowNumber}
            />)}
            <td className="planilha-actions">
              <button aria-label={`Adicionar linha abaixo de ${rowNumber}`} disabled={readOnly} onClick={() => onRowAdd(index)} type="button"><Plus size={15} /></button>
              <button aria-label={`Duplicar linha ${rowNumber}`} disabled={readOnly} onClick={() => onRowDuplicate(index)} type="button"><Copy size={15} /></button>
              <button aria-label={`Remover linha ${rowNumber}`} className="planilha-remove" disabled={readOnly || sheet.rows.length === 1} onClick={() => onRowRemove(index)} type="button"><Trash2 size={15} /></button>
            </td>
          </tr>;
        })}
      </tbody>
      <tfoot>
        <tr>
          <td className="planilha-gutter planilha-gutter-total">{rowNumberAt(sheet.rows.length - 1) + 1}</td>
          <th className="planilha-kind planilha-kind-total" scope="row">Soma</th>
          {PLANILHA_COLUMNS.map((column) => <td className={column.role === "spacer" ? "planilha-spacer" : "planilha-cell planilha-total"} key={column.letter}>
            {column.role === "formula" ? formatPlanilhaCell(evaluation.columnTotals[column.key], column.format) : null}
          </td>)}
          <td className="planilha-actions" />
        </tr>
      </tfoot>
    </table>
  </div>;
}

function Cell({ column, row, cell, rowNumber, disabled, onChange }) {
  const mask = (value, pad = false) => column.key === "label"
    ? maskPlanilhaCompetence(value)
    : maskPlanilhaDecimal(value, { percent: column.format === "percent", pad });

  const handleChange = (event) => {
    const input = event.target;
    const position = input.selectionStart;
    const value = mask(input.value);
    const cursor = Math.min(position, value.endsWith("%") ? value.length - 1 : value.length);
    onChange(value);
    requestAnimationFrame(() => {
      if (document.activeElement === input) input.setSelectionRange(cursor, cursor);
    });
  };
  if (column.role === "spacer") return <td className="planilha-spacer" />;

  if (column.role === "formula") {
    return <td className="planilha-cell planilha-formula" data-cell={`${column.letter}${rowNumber}`}>
      <span>{formatPlanilhaCell(cell?.[column.key], column.format)}</span>
    </td>;
  }

  return <td className="planilha-cell planilha-input" data-cell={`${column.letter}${rowNumber}`}>
    <input
      aria-label={`${column.label} — linha ${rowNumber}`}
      disabled={disabled}
      inputMode={column.key === "label" ? "text" : "decimal"}
      onChange={handleChange}
      onBlur={(event) => onChange(mask(event.target.value, true))}
      placeholder={inputPlaceholder(column, row.kind)}
      value={mask(row[column.key])}
    />
  </td>;
}

/**
 * A coluna B só é lida pelas regras base, reajuste e fração. Nas demais linhas o
 * placeholder vira um traço para não sugerir um valor a ser digitado.
 */
function inputPlaceholder(column, kind) {
  if (column.key === "label") return "MM/AAAA";
  if (column.key === "adjustment" && kind === "monthly") return "—";
  return column.format === "percent" ? "0,00%" : "0,000000";
}
