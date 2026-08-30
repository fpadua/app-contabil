"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Bookmark, Building2, CalendarDays, Calculator, ChartNoAxesColumnIncreasing, Check, Info, Landmark, Scale, Users, X } from "lucide-react";
import { Stepper } from "./stepper";
import { SummaryCard } from "./summary-card";

const calculationTypes = [
  { id: "monetary", label: "Correção monetária", description: "Atualização de valores por índices econômicos.", icon: ChartNoAxesColumnIncreasing },
  { id: "sac", label: "Financiamento SAC", description: "Sistema de Amortização Constante.", icon: Building2 },
  { id: "price", label: "Financiamento PRICE", description: "Sistema Francês de Amortização.", icon: Landmark },
  { id: "salary", label: "Diferença salarial", description: "Cálculo de diferenças salariais e reflexos.", icon: Users },
  { id: "judicial", label: "Cálculo judicial", description: "Regras personalizadas para demandas judiciais.", icon: Scale },
];

const initialForm = {
  type: "monetary", typeLabel: "Correção monetária", amount: "R$ 10.000,00",
  startDate: "01/01/2023", endDate: "31/05/2024", index: "IPCA-E (IBGE)",
  interest: "0,00", interestType: "Simples", indexLag: "Sem defasagem",
};

export function CalculationWizard() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(initialForm);
  const selectedType = calculationTypes.find((item) => item.id === form.type);
  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const selectType = (type) => setForm((current) => ({ ...current, type: type.id, typeLabel: type.label }));

  return (
    <section className="workspace">
      <header className="topbar">
        <div><h1>Novo cálculo</h1><p>Siga os passos para configurar seu cálculo com segurança e precisão.</p></div>
        <div className="top-actions"><button className="secondary-button" type="button"><Bookmark size={17} /> Salvar rascunho</button><button className="icon-button" aria-label="Fechar cálculo" type="button"><X size={19} /></button></div>
      </header>
      <Stepper currentStep={step} />
      <div className="content-grid">
        <div className="form-panel">
          {step === 1 && <TypeStep form={form} update={update} selectType={selectType} />}
          {step === 2 && <DataStep form={form} update={update} selectedType={selectedType} />}
          {step === 3 && <RulesStep form={form} update={update} />}
          {step === 4 && <ResultStep form={form} />}
          <div className="source-warning"><Info size={17} /> Os índices e parâmetros utilizados ficam registrados com fonte, competência e versão.</div>
          <div className="wizard-actions">
            {step > 1 && <button className="back-button" onClick={() => setStep((current) => current - 1)} type="button"><ArrowLeft size={17} /> Voltar</button>}
            {step < 4 && <button className="primary-button" onClick={() => setStep((current) => current + 1)} type="button">Avançar <ArrowRight size={18} /></button>}
            {step === 4 && <button className="primary-button" type="button">Salvar cálculo <Check size={18} /></button>}
          </div>
        </div>
        <SummaryCard form={form} step={step} />
      </div>
    </section>
  );
}

function TypeStep({ form, update, selectType }) {
  return <>
    <h2>Selecione o tipo de cálculo</h2>
    <div className="type-grid">
      {calculationTypes.map((type) => {
        const Icon = type.icon;
        const selected = form.type === type.id;
        return <button className={`type-card ${selected ? "selected" : ""}`} key={type.id} onClick={() => selectType(type)} type="button">
          <span className="type-icon"><Icon size={28} strokeWidth={1.6} /></span>
          <span><strong>{type.label}</strong><small>{type.description}</small></span>
          <span className="selection">{selected && <Check size={13} />}</span>
        </button>;
      })}
    </div>
    <BasicFields form={form} update={update} />
  </>;
}

function BasicFields({ form, update }) {
  return <div className="section-block"><h2>Dados básicos do cálculo</h2><div className="fields-grid">
    <Field label="Valor" value={form.amount} onChange={(value) => update("amount", value)} />
    <Field icon={CalendarDays} label="Data inicial" value={form.startDate} onChange={(value) => update("startDate", value)} />
    <Field icon={CalendarDays} label="Data final" value={form.endDate} onChange={(value) => update("endDate", value)} />
    <IndexField form={form} update={update} />
  </div></div>;
}

function DataStep({ form, update, selectedType }) {
  return <div className="step-content">
    <div className="eyebrow">{selectedType.label}</div><h2>Informe os dados do cálculo</h2>
    <p className="section-description">Os campos serão adaptados ao modelo escolhido. Nesta etapa, os dados ainda podem ser importados de uma planilha.</p>
    <div className="fields-grid">
      <Field label="Valor principal" value={form.amount} onChange={(value) => update("amount", value)} />
      <Field label="Identificação do contrato ou processo" value="Processo demonstrativo" />
      <Field icon={CalendarDays} label="Data de origem" value={form.startDate} onChange={(value) => update("startDate", value)} />
      <Field icon={CalendarDays} label="Atualizar até" value={form.endDate} onChange={(value) => update("endDate", value)} />
    </div>
    <button className="import-button" type="button"><Calculator size={18} /> Importar lançamentos de uma planilha</button>
  </div>;
}

function RulesStep({ form, update }) {
  return <div className="step-content"><h2>Defina as regras de atualização</h2>
    <p className="section-description">Cada regra receberá um identificador e ficará ligada à planilha, à fórmula e ao teste que a valida.</p>
    <div className="rule-card"><div className="rule-number">1</div><div className="rule-body">
      <strong>Período principal</strong><span>{form.startDate} a {form.endDate}</span>
      <div className="fields-grid compact">
        <IndexField form={form} update={update} />
        <SelectField label="Defasagem" value={form.indexLag} onChange={(value) => update("indexLag", value)} options={["Sem defasagem", "Mês anterior", "Segundo mês anterior"]} />
        <Field label="Juros ao mês (%)" value={form.interest} onChange={(value) => update("interest", value)} />
        <SelectField label="Regime de juros" value={form.interestType} onChange={(value) => update("interestType", value)} options={["Simples", "Capitalizados"]} />
      </div>
    </div></div>
    <button className="add-rule-button" type="button">+ Adicionar mudança de regra por período</button>
  </div>;
}

function ResultStep({ form }) {
  return <div className="step-content"><span className="result-icon"><Check size={28} /></span><h2>Memória de cálculo preparada</h2>
    <p className="section-description">O resultado preserva os dados de entrada, as competências utilizadas e a versão de cada regra.</p>
    <div className="result-table" role="table" aria-label="Prévia da memória de cálculo">
      <div className="result-row header"><span>Competência</span><span>Índice</span><span>Fator</span><span>Valor corrigido</span></div>
      <div className="result-row"><span>01/2023</span><span>{form.index}</span><span>1,0055</span><span>R$ 10.055,00</span></div>
      <div className="result-row"><span>02/2023</span><span>{form.index}</span><span>1,0131</span><span>R$ 10.131,00</span></div>
      <div className="result-row"><span>…</span><span>…</span><span>…</span><span>…</span></div>
      <div className="result-row"><span>05/2024</span><span>{form.index}</span><span>1,097519</span><span>R$ 10.975,19</span></div>
    </div>
  </div>;
}

function IndexField({ form, update }) {
  return <SelectField label="Indexador" value={form.index} onChange={(value) => update("index", value)} options={["IPCA-E (IBGE)", "IPCA (IBGE)", "INPC (IBGE)", "IGP-M (FGV)", "TR (Bacen)"]} />;
}

function Field({ label, value, onChange = () => {}, icon: Icon }) {
  return <label className="field"><span>{label} <Info size={12} /></span><div className="input-wrap"><input value={value} onChange={(event) => onChange(event.target.value)} />{Icon && <Icon size={17} />}</div></label>;
}

function SelectField({ label, value, onChange, options }) {
  return <label className="field"><span>{label} <Info size={12} /></span><select value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option}>{option}</option>)}</select></label>;
}
