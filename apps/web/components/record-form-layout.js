import Link from "next/link";
import { ArrowLeft, CheckCircle2, ShieldCheck } from "lucide-react";

export function RecordFormLayout({ eyebrow, title, description, backHref, summaryTitle, summaryItems, children }) {
  return (
    <section className="workspace record-workspace">
      <header className="record-header">
        <Link className="record-back" href={backHref}><ArrowLeft size={16} /> Voltar</Link>
        <div><span className="module-eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>
      </header>

      <div className="record-layout">
        <div className="record-form-card">{children}</div>
        <aside className="record-summary">
          <div className="record-summary-icon"><ShieldCheck size={22} /></div>
          <h2>{summaryTitle}</h2>
          <ul>{summaryItems.map((item) => <li key={item}><CheckCircle2 size={15} /><span>{item}</span></li>)}</ul>
          <p>Os dados são persistidos no sistema e ficam disponíveis para consulta e cálculos em qualquer dispositivo.</p>
        </aside>
      </div>
    </section>
  );
}

export function FormSection({ number, title, description, children }) {
  return (
    <section className="record-section">
      <div className="record-section-heading"><span>{number}</span><div><h2>{title}</h2>{description && <p>{description}</p>}</div></div>
      <div className="record-section-body">{children}</div>
    </section>
  );
}

export function FormActions({ cancelHref, submitLabel, submitting = false }) {
  return (
    <div className="record-actions">
      <Link className="back-button" href={cancelHref}>Cancelar</Link>
      <button className="primary-button" disabled={submitting} type="submit">{submitting ? "Salvando..." : submitLabel}</button>
    </div>
  );
}
