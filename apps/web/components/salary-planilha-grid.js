"use client";

import { Copy, Trash2 } from "lucide-react";
import { useLayoutEffect, useRef } from "react";
import { PLANILHA_COLUMNS, PLANILHA_ROW_KIND_OPTIONS, formatPlanilhaCell, maskPlanilhaCompetence, maskPlanilhaDecimal, planilhaCompetenceCursorPosition, rowNumberAt } from "../lib/planilha";

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
export function SalaryPlanilhaGrid({ sheet, appliedRows = sheet.rows, evaluation, onChange, onRowDuplicate, onRowRemove, readOnly = false }) {
  const updateRow = (index, field, value) => {
    onChange(sheet.rows.map((row, current) => (current === index ? { ...row, [field]: value } : row)));
  };

  return <>
    <div className="planilha-scroll planilha-desktop-grid" role="region" aria-label="Grade de cálculo das diferenças remuneratórias" tabIndex={0}>
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
              disabled={readOnly || Boolean(appliedRows[index]?.incidenceLocked?.[column.key])}
              key={column.letter}
              onChange={(value) => updateRow(index, column.key, value)}
              row={appliedRows[index] ?? row}
              rowNumber={rowNumber}
            />)}
            <td className="planilha-actions">
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
    </div>
    <div className="planilha-mobile-editor" aria-label="Editor de lançamentos">
      <div className="planilha-mobile-editor-heading"><div><strong>Lançamentos</strong><span>Preencha os campos azuis. Os valores calculados aparecem automaticamente.</span></div><span>{sheet.rows.length}</span></div>
      {sheet.rows.map((row, index) => <MobileRow
        appliedRow={appliedRows[index] ?? row}
        evaluationRow={evaluation.rows[index]}
        index={index}
        key={row.id}
        onChange={(field, value) => updateRow(index, field, value)}
        onDuplicate={() => onRowDuplicate(index)}
        onRemove={() => onRowRemove(index)}
        readOnly={readOnly}
        row={row}
        rowsCount={sheet.rows.length}
      />)}
      <div className="planilha-mobile-total"><span>Total calculado</span><strong>{formatPlanilhaCell(evaluation.columnTotals.total, "currency")}</strong></div>
    </div>
  </>;
}

function MobileRow({ row, appliedRow, evaluationRow, index, rowsCount, readOnly, onChange, onDuplicate, onRemove }) {
  const rowNumber = rowNumberAt(index);
  const editFields = [
    { key: "label", label: "Competência / evento", format: "text", inputMode: "text", placeholder: "MM/AAAA" },
    { key: "adjustment", label: "Índice de reajuste", format: "percent", inputMode: "decimal", placeholder: "0,00%" },
    { key: "correction", label: "Índice de atualização", format: "factor", inputMode: "decimal", placeholder: "0,000000" },
    { key: "interest", label: "Juros", format: "percent", inputMode: "decimal", placeholder: "0,00%" },
    { key: "selic", label: "Taxa Selic", format: "percent", inputMode: "decimal", placeholder: "0,00%" },
  ];
  return <article className="planilha-mobile-row">
    <div className="planilha-mobile-row-heading"><strong>Lançamento {rowNumber}</strong><span>{row.kind === "base" ? "Base inicial" : rowKindHint(row.kind)}</span></div>
    <label className="planilha-mobile-kind field"><span>Regra aplicada</span><select disabled={readOnly} onChange={(event) => onChange("kind", event.target.value)} value={row.kind}>{kindOptions(index).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
    <div className="planilha-mobile-fields">{editFields.map((field) => <MobileInput disabled={readOnly || Boolean(appliedRow.incidenceLocked?.[field.key])} field={field} key={field.key} onChange={(value) => onChange(field.key, value)} value={row[field.key]} />)}</div>
    <div className="planilha-mobile-calculated" aria-label={`Valores calculados do lançamento ${rowNumber}`}>
      {[{ key: "due", label: "Devido" }, { key: "received", label: "Recebido" }, { key: "difference", label: "Diferença" }, { key: "total", label: "Total" }].map(({ key, label }) => <div key={key}><span>{label}</span><strong>{formatPlanilhaCell(evaluationRow?.[key], "currency") || "—"}</strong></div>)}
    </div>
    <div className="planilha-mobile-actions"><button className="secondary-button" disabled={readOnly} onClick={onDuplicate} type="button"><Copy size={15} /> Duplicar</button><button className="secondary-button rule-remove" disabled={readOnly || rowsCount === 1} onClick={onRemove} type="button"><Trash2 size={15} /> Remover</button></div>
  </article>;
}

function MobileInput({ field, value, disabled, onChange }) {
  const mask = (input) => field.format === "text" ? maskPlanilhaCompetence(input) : maskPlanilhaDecimal(input, { percent: field.format === "percent" });
  const handleBlur = (input) => field.format === "text" ? maskPlanilhaCompetence(input) : maskPlanilhaDecimal(input, { percent: field.format === "percent", pad: true });
  return <label className="field"><span>{field.label}</span><input disabled={disabled} inputMode={field.inputMode} onBlur={(event) => onChange(handleBlur(event.target.value))} onChange={(event) => onChange(mask(event.target.value))} placeholder={field.placeholder} value={mask(value)} /></label>;
}

function Cell({ column, row, cell, rowNumber, disabled, onChange }) {
  const inputRef = useRef(null);
  const cursorPositionRef = useRef(null);
  const mask = (value, pad = false) => column.key === "label"
    ? maskPlanilhaCompetence(value)
    : maskPlanilhaDecimal(value, { percent: column.format === "percent", pad });
  const maskedValue = mask(row[column.key]);

  useLayoutEffect(() => {
    const cursor = cursorPositionRef.current;
    const input = inputRef.current;
    if (cursor == null) return;
    if (!input || document.activeElement !== input) {
      cursorPositionRef.current = null;
      return;
    }
    input.setSelectionRange(cursor, cursor);
    cursorPositionRef.current = null;
  });

  const handleKeyDown = (event) => {
    if (column.key !== "label" || event.key.length !== 1 || !/\d/.test(event.key)) return;
    const input = event.currentTarget;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? start;
    if (start !== end) return;

    const nextInput = `${input.value.slice(0, start)}${event.key}${input.value.slice(end)}`;
    cursorPositionRef.current = planilhaCompetenceCursorPosition(nextInput, start + 1);
    onChange(mask(nextInput));
    event.preventDefault();
  };

  const handleChange = (event) => {
    const input = event.target;
    const position = input.selectionStart;
    const value = mask(input.value);
    const cursor = column.key === "label"
      ? planilhaCompetenceCursorPosition(input.value, position)
      : Math.min(position, value.endsWith("%") ? value.length - 1 : value.length);
    cursorPositionRef.current = cursor;
    onChange(value);
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
      onKeyDown={handleKeyDown}
      onChange={handleChange}
      onBlur={(event) => onChange(mask(event.target.value, true))}
      placeholder={inputPlaceholder(column, row.kind)}
      ref={inputRef}
      value={maskedValue}
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
