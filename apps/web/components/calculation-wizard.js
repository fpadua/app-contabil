"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Bookmark, Building2, CalendarDays, Calculator, ChartNoAxesColumnIncreasing, Check, Copy, Download, FileUp, GripVertical, Info, Landmark, Link2, Loader2, Plus, Scale, Trash2, Users, X } from "lucide-react";
import { Stepper } from "./stepper";
import { SummaryCard } from "./summary-card";
import { CalculationMemoryTable } from "./calculation-memory-table";
import { CalculationAmortizationTable } from "./calculation-amortization-table";
import { api } from "../lib/api";
import { downloadCalculationCsv } from "../lib/calculation-export";

const calculationTypes = [
  { id: "monetary", label: "Correção monetária", description: "Atualização de valores por índices econômicos.", icon: ChartNoAxesColumnIncreasing },
  { id: "sac", label: "Financiamento SAC", description: "Sistema de Amortização Constante.", icon: Building2 },
  { id: "price", label: "Financiamento PRICE", description: "Sistema Francês de Amortização.", icon: Landmark },
  { id: "salary", label: "Diferença salarial", description: "Cálculo de diferenças salariais e reflexos.", icon: Users },
  { id: "judicial", label: "Cálculo judicial", description: "Regras personalizadas para demandas judiciais.", icon: Scale },
];

const indexSlugs = {
  "IPCA (IBGE)": "ipca",
  "IPCA-E (IBGE)": "ipca_e",
  "INPC (IBGE)": "inpc",
  "IGP-M (FGV)": "igp_m",
  "TR (Bacen)": "tr",
  "Poupança (Bacen)": "poupanca",
  "Taxa Selic (Bacen)": "selic_bacen",
};

const recentRange = (() => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 0);
  const pad = (value) => String(value).padStart(2, "0");
  return {
    startDate: `${pad(start.getDate())}/${pad(start.getMonth() + 1)}/${start.getFullYear()}`,
    endDate: `${pad(end.getDate())}/${pad(end.getMonth() + 1)}/${end.getFullYear()}`,
  };
})();

const initialForm = {
  type: "monetary", typeLabel: "Correção monetária", amount: "R$ 10.000,00", title: "Processo demonstrativo",
  startDate: recentRange.startDate, endDate: recentRange.endDate, index: "IPCA-E (IBGE)",
  interest: "0,00", interestType: "Simples", indexLag: "Sem defasagem", clientId: "", processId: "",
  months: "12", salaryPrevious: "R$ 3.000,00", salaryNew: "R$ 3.300,00", decimoTerceiro: true, vacationsWithBonus: true,
  selicFactor: "0,5", ruleChanges: [], salaryEntries: [], citationDate: "", salaryRules: { correctionIndex: "IPCA-E (IBGE)", correctionStartDate: "", correctionEndDate: "", savingsIndex: "Poupança (Bacen)", savingsStartDate: "", savingsEndDate: "08/12/2021", selicIndex: "Taxa Selic (Bacen)", selicStartDate: "09/12/2021" },
};

export function CalculationWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const draftId = searchParams.get("rascunho");
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(initialForm);
  const [result, setResult] = useState(null);
  const [importStatus, setImportStatus] = useState(null);
  const [importError, setImportError] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const [draftError, setDraftError] = useState(null);
  const fileInputRef = useRef(null);
  const loadedDraftId = useRef(null);
  const draft = useQuery({ queryKey: ["calculation-draft", draftId], queryFn: () => api.get(`/api/calculations/${draftId}`), enabled: Boolean(draftId) });
  const selectedType = calculationTypes.find((item) => item.id === form.type);
  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const selectType = (type) => setForm((current) => ({ ...current, type: type.id, typeLabel: type.label }));

  const calc = useMutation({
    mutationFn: (payload) => api.post("/api/calculations/run", payload),
    onSuccess: (data) => setResult((current) => ({ ...current, pending: false, error: null, data })),
    onError: (error) => setResult((current) => ({ ...current, pending: false, error })),
  });

  const save = useMutation({
    mutationFn: (payload) => api.post("/api/calculations", payload),
    onSuccess: () => router.push("/calculos"),
  });

  const saveDraft = useMutation({
    mutationFn: (payload) => api.post("/api/calculations", payload),
    onSuccess: (data) => {
      setDraftSaved(true);
      router.replace(`/calculos/${data.id}`);
    },
  });

  useEffect(() => {
    if (!draft.data || draft.data.status !== "Rascunho" || loadedDraftId.current === draft.data.id) return;
    setForm(restoreDraftForm(draft.data));
    setResult(null);
    setStep(2);
    loadedDraftId.current = draft.data.id;
  }, [draft.data]);

  function openResultStep() {
    setStep(4);
    const key = calculationKey(form);
    if (result?.key === key) return;
    const payload = buildPayload(form);
    if (!payload) {
      setResult({ key, pending: false, data: null, error: new Error("Confira os valores, as datas e as mudanças de regra informados nos passos anteriores.") });
      return;
    }
    setResult({ key, pending: true, data: null, error: null });
    calc.mutate(payload);
  }

  function handleNext() {
    if (step === 3) {
      openResultStep();
    } else {
      setStep((current) => current + 1);
    }
  }

  function handleSaveDraft() {
    setDraftError(null);
    const payload = draftPayload(form);
    if (!payload) {
      setDraftError("Não foi possível salvar o rascunho: confira as datas e o valor.");
      return;
    }
    saveDraft.mutate(payload);
  }

  async function handleImportFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const parsed = parseCsvLancamentos(await file.text());
    if (!parsed) {
      setImportError(true);
      setImportStatus("Não foi possível interpretar a planilha. Use colunas como competência (dd/mm/aaaa) e valor, com separador ; ou , e cabeçalho.");
      return;
    }
    setImportError(false);
    setForm((current) => {
      const next = { ...current };
      if (parsed.amount != null) {
        if (next.type === "salary") next.salaryNew = maskCurrencyFromNumber(parsed.amount);
        else next.amount = maskCurrencyFromNumber(parsed.amount);
      }
      if (parsed.rate != null && (next.type === "sac" || next.type === "price")) next.interest = maskPercent(parsed.rate);
      if (parsed.startDate && parsed.endDate) {
        next.startDate = parsed.startDate;
        next.endDate = parsed.endDate;
      }
      if (parsed.rows && (next.type === "sac" || next.type === "price")) next.months = String(parsed.rows);
      return next;
    });
    setImportStatus(`Planilha interpretada: ${parsed.rows} lançamento(s)${parsed.startDate ? `, período ${parsed.startDate} a ${parsed.endDate}` : ""}${parsed.amount != null ? `, valor ${maskCurrencyFromNumber(parsed.amount)}` : ""}. Revise os campos e avance.`);
  }

  return (
    <section className="workspace">
      <header className="topbar">
        <div><h1>Novo cálculo</h1><p>Siga os passos para configurar seu cálculo com segurança e precisão.</p></div>
        <div className="top-actions">
          <button className="secondary-button" type="button" disabled={saveDraft.isPending} onClick={handleSaveDraft}>
            {saveDraft.isPending ? <Loader2 className="spinning" size={17} /> : draftSaved ? <Check size={17} /> : <Bookmark size={17} />}
            {saveDraft.isPending ? "Salvando..." : draftSaved ? "Rascunho salvo" : "Salvar rascunho"}
          </button>
          <button className="icon-button" aria-label="Fechar cálculo" type="button" onClick={() => router.push("/calculos")}><X size={19} /></button>
        </div>
      </header>
      {draftError && <div className="module-status error" role="alert">{draftError}</div>}
      {draft.isError && <div className="module-status error" role="alert">NÃ£o foi possÃ­vel abrir este rascunho para ediÃ§Ã£o.</div>}
      {draft.data?.status === "Rascunho" && !draft.data?.params?.draftForm && <div className="module-status" role="status">Este rascunho foi salvo antes do armazenamento de lanÃ§amentos e regras. Os dados detalhados nÃ£o podem ser recuperados porque nÃ£o foram gravados no registro.</div>}
      <Stepper currentStep={step} />
      <div className="content-grid">
        <div className="form-panel">
          {step === 1 && <TypeStep form={form} update={update} selectType={selectType} />}
          {step === 2 && <DataStep form={form} update={update} selectedType={selectedType} importStatus={importStatus} importError={importError} onFile={handleImportFile} fileInputRef={fileInputRef} />}
          {step === 3 && <RulesStep form={form} update={update} />}
          {step === 4 && <ResultStep form={form} result={result} />}
          <div className="source-warning"><Info size={17} /> Os índices e parâmetros utilizados ficam registrados com fonte, competência e versão.</div>
          <div className="wizard-actions">
            {step > 1 && <button className="back-button" onClick={() => setStep((current) => current - 1)} type="button"><ArrowLeft size={17} /> Voltar</button>}
            {step < 4 && <button className="primary-button" onClick={handleNext} type="button">Avançar <ArrowRight size={18} /></button>}
            {step === 4 && <button className="primary-button" disabled={result?.pending || !result?.data || save.isPending} onClick={() => save.mutate({ title: form.title, calculationType: form.typeLabel, clientId: form.clientId || undefined, processId: form.processId || undefined, result: result.data })} type="button">{save.isPending ? <Loader2 className="spinning" size={18} /> : <Check size={18} />} {save.isPending ? "Salvando..." : "Salvar cálculo"}</button>}
          </div>
        </div>
        <SummaryCard form={form} step={step} result={result} />
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
  if (form.type === "salary") {
    return <div className="section-block"><h2>Dados básicos do cálculo</h2><div className="fields-grid">
      <MoneyField label="Salário recebido base" value={form.salaryPrevious} onChange={(value) => update("salaryPrevious", value)} />
      <IndexField form={form} update={update} />
    </div></div>;
  }
  const amountLabel = form.type === "monetary" ? "Valor" : "Valor do financiamento";
  return <div className="section-block"><h2>Dados básicos do cálculo</h2><div className="fields-grid">
    <MoneyField label={amountLabel} value={form.amount} onChange={(value) => update("amount", value)} />
    <Field icon={CalendarDays} label="Data inicial" value={form.startDate} onChange={(value) => update("startDate", value)} />
    <Field icon={CalendarDays} label="Data final" value={form.endDate} onChange={(value) => update("endDate", value)} />
    <IndexField form={form} update={update} withNone={form.type === "sac" || form.type === "price"} />
  </div></div>;
}

function DataStep({ form, update, selectedType, importStatus, importError, onFile, fileInputRef }) {
  const clients = useQuery({ queryKey: ["client-options"], queryFn: () => api.get("/api/clients/options") });
  const processes = useQuery({ queryKey: ["process-options"], queryFn: () => api.get("/api/processes/options") });
  const clientOptions = (clients.data ?? []).map((client) => ({ id: client.id, label: client.name }));
  const visibleProcesses = (processes.data ?? []).filter((process) => !form.clientId || process.clientId === form.clientId);
  const processOptions = visibleProcesses.map((process) => ({ id: process.id, label: `${process.title}${process.number ? ` (${process.number})` : ""}` }));
  const handleClientChange = (value) => {
    update("clientId", value);
    update("processId", "");
  };
  return <div className="step-content">
    <div className="eyebrow">{selectedType.label}</div><h2>Informe os dados do cálculo</h2>
    <p className="section-description">Os campos foram adaptados ao modelo escolhido. Nesta etapa, os dados ainda podem ser importados de uma planilha.</p>
    <div className={`fields-grid ${form.type === "salary" ? "salary-data-fields" : ""}`}>
      {form.type === "monetary" && <>
        <MoneyField label="Valor principal" value={form.amount} onChange={(value) => update("amount", value)} />
        <Field label="Identificação do contrato ou processo" value={form.title} onChange={(value) => update("title", value)} />
        <Field icon={CalendarDays} label="Data de origem" value={form.startDate} onChange={(value) => update("startDate", value)} />
        <Field icon={CalendarDays} label="Atualizar até" value={form.endDate} onChange={(value) => update("endDate", value)} />
      </>}
      {(form.type === "sac" || form.type === "price") && <>
        <MoneyField label="Valor do financiamento" value={form.amount} onChange={(value) => update("amount", value)} />
        <NumberField label="Número de parcelas" value={form.months} onChange={(value) => update("months", value)} />
        <NumberField label="Juros ao mês (%)" value={form.interest} onChange={(value) => update("interest", value)} hint="Ex.: 1,00 para 1% ao mês" />
        <IndexField form={form} update={update} withNone label={form.type === "sac" ? "Índice para atualização (SAC)" : "Índice para atualização (PRICE)"} />
        <Field icon={CalendarDays} label="Data de origem" value={form.startDate} onChange={(value) => update("startDate", value)} />
        <Field icon={CalendarDays} label="Atualizar até" value={form.endDate} onChange={(value) => update("endDate", value)} />
      </>}
      {form.type === "salary" && <>
        <MoneyField label="Salário recebido base" value={form.salaryPrevious} onChange={(value) => update("salaryPrevious", value)} />
        <IndexField form={form} update={update} />
        <Field label="Identificação do contrato ou processo" value={form.title} onChange={(value) => update("title", value)} />
        <Field icon={CalendarDays} label="Data de origem" value={form.startDate} onChange={(value) => update("startDate", value)} />
        <Field icon={CalendarDays} label="Atualizar até" value={form.endDate} onChange={(value) => update("endDate", value)} />
      </>}
      {form.type === "judicial" && <>
        <MoneyField label="Valor a corrigir" value={form.amount} onChange={(value) => update("amount", value)} />
        <NumberField label="Acréscimo Selic acumulado (%)" value={form.selicFactor} onChange={(value) => update("selicFactor", value)} hint="Opcional. Fase Selic é aplicada a partir de 09/12/2021" />
        <Field label="Identificação do contrato ou processo" value={form.title} onChange={(value) => update("title", value)} />
        <Field icon={CalendarDays} label="Data de origem" value={form.startDate} onChange={(value) => update("startDate", value)} />
        <Field icon={CalendarDays} label="Atualizar até" value={form.endDate} onChange={(value) => update("endDate", value)} />
      </>}
    </div>
    {form.type === "salary" && <SalaryEntriesEditor entries={form.salaryEntries} salaryReceived={form.salaryPrevious} citationDate={form.citationDate} onCitationDateChange={(value) => update("citationDate", value)} onChange={(entries) => update("salaryEntries", entries)} />}
    <div className="section-block vinculacao"><h2>Vincular a cliente e processo <Link2 size={15} /></h2>
      <div className="fields-grid compact">
        <OptionSelectField label="Cliente" value={form.clientId} onChange={handleClientChange} options={clientOptions} placeholder={clients.isLoading ? "Carregando clientes..." : "Sem vínculo"} disabled={clients.isLoading} />
        <OptionSelectField label="Processo" value={form.processId} onChange={(value) => update("processId", value)} options={processOptions} placeholder={processes.isLoading ? "Carregando processos..." : form.clientId ? "Nenhum processo do cliente" : "Selecione um cliente primeiro"} disabled={processes.isLoading || !form.clientId || !visibleProcesses.length} />
      </div>
      <p className="section-description">O vínculo identifica a qual cliente e processo este cálculo pertence nos cadastros.</p>
    </div>
    <div className="import-zone">
      <button className="import-button" type="button" onClick={() => fileInputRef.current?.click()}><FileUp size={18} /> Importar lançamentos de uma planilha</button>
      <input ref={fileInputRef} hidden type="file" accept=".csv,text/csv" onChange={onFile} />
      {importStatus && <p className={`import-status ${importError ? "error" : ""}`} role={importError ? "alert" : "status"}>{importStatus}</p>}
    </div>
  </div>;
}

function RulesStep({ form, update }) {
  if (form.type === "salary" && form.salaryEntries.length > 0) return <SalaryRulesEditor form={form} update={update} />;
  if (form.type !== "monetary") {
    const summary = ruleSummary(form);
    return <div className="step-content"><h2>Regras que serão aplicadas</h2>
      <p className="section-description">Cada regra recebe um identificador e fica ligada à fórmula e ao teste que a valida (ver matriz de rastreabilidade).</p>
      <div className="rule-card"><div className="rule-number">R</div><div className="rule-body">
        <strong>{summary.title}</strong><span>{summary.description}</span>
        {form.type === "salary" && form.salaryEntries.length > 0 && <span className="rule-tag">IPCA-E automático · Poupança até 08/12/2021 · Selic a partir de 09/12/2021</span>}
        <span className="rule-tag">{summary.ruleIds}</span>
      </div></div>
      <p className="section-description"><Info size={14} /> O índice selecionado no passo anterior é consultado a partir da série oficial mensal; períodos sem cobertura interrompem o cálculo com mensagem clara.</p>
    </div>;
  }
  const ruleChanges = form.ruleChanges ?? [];
  const addRuleChange = () => {
    const defaultDate = oneMonthAfter(form.startDate);
    update("ruleChanges", [...ruleChanges, { date: defaultDate, index: form.index === "IPCA-E (IBGE)" || form.index === "Sem correção" ? "IPCA (IBGE)" : "INPC (IBGE)" }]);
  };
  const changeRuleChange = (index, field, value) => {
    const next = ruleChanges.slice();
    next[index] = { ...next[index], [field]: value };
    update("ruleChanges", next);
  };
  const removeRuleChange = (index) => update("ruleChanges", ruleChanges.filter((_, item) => item !== index));
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
    {ruleChanges.length > 0 && <div className="rule-changes">
      {ruleChanges.map((change, index) => (
        <div className="rule-change-row" key={index}>
          <div className="fields-grid compact">
            <Field label={`Válida a partir de (dia ${index + 2})`} value={change.date} onChange={(value) => changeRuleChange(index, "date", value)} />
            <SelectField label="Índice deste período" value={change.index} onChange={(value) => changeRuleChange(index, "index", value)} options={["IPCA-E (IBGE)", "IPCA (IBGE)", "INPC (IBGE)", "IGP-M (FGV)", "TR (Bacen)", "Taxa Selic (Bacen)"]} />
          </div>
          <button className="icon-button rule-remove" aria-label="Remover mudança de regra" type="button" onClick={() => removeRuleChange(index)}><Trash2 size={16} /></button>
        </div>
      ))}
    </div>}
    <button className="add-rule-button" type="button" onClick={addRuleChange}>+ Adicionar mudança de regra por período</button>
    {ruleChanges.length > 0 && <p className="section-description rule-change-note"><Info size={14} /> O índice do período principal vale até a data de cada mudança; a partir dela, o índice indicado passa a valer até o fim do intervalo.</p>}
  </div>;
}

function ruleSummary(form) {
  switch (form.type) {
    case "sac":
      return {
        title: "Sistema de Amortização Constante (SAC)",
        ruleIds: form.index === "TR (Bacen)" ? "REGRA-SAC-002" : "REGRA-SAC-001 - REGRA-SAC-002",
        description: "Amortização constante sobre o principal, juros decrescentes sobre o saldo devedor e atualização monetária pelo índice selecionado.",
      };
    case "price":
      return { title: "Sistema Francês de Amortização (PRICE)", ruleIds: "REGRA-PRICE-001", description: "Prestação constante composta de juros e capital, com a parcela de capital crescendo a cada mês." };
    case "salary":
      return form.salaryEntries.length > 0
        ? { title: "Diferença salarial detalhada", ruleIds: "REGRA-DIF-002", description: "Os lançamentos definem as diferenças; IPCA-E, poupança e Selic são consultados automaticamente nas séries cadastradas." }
        : { title: "Diferença salarial com reflexos", ruleIds: "REGRA-DIF-001", description: "Diferença entre o novo e o anterior vencimento corrigida mês a mês pelo índice, com reflexos de 13º salário e férias + 1/3." };
    case "judicial":
      return { title: "Correção judicial (IPCA-E + Selic)", ruleIds: "REGRA-JUD-001", description: "Fase 1 com atualização pelo IPCA-E mensal e fase Selic aplicada ao fator acumulado informado a partir de 09/12/2021." };
    default:
      return { title: form.typeLabel, ruleIds: "—", description: "" };
  }
}

function SalaryRulesEditor({ form, update }) {
  const rules = form.salaryRules;
  const change = (field, value) => update("salaryRules", { ...rules, [field]: value });
  const indexOptions = ["IPCA-E (IBGE)", "IPCA (IBGE)", "INPC (IBGE)", "IGP-M (FGV)", "TR (Bacen)", "Poupança (Bacen)", "Taxa Selic (Bacen)"];
  return <div className="step-content salary-rules-step"><h2>Configure as regras do cálculo</h2><p className="section-description">Essas escolhas são aplicadas à memória detalhada. Períodos sem cobertura nas séries cadastradas impedem o cálculo.</p>
    <div className="rule-card"><div className="rule-number">1</div><div className="rule-body"><strong>Correção monetária</strong><div className="salary-rule-fields"><SelectField label="Índice" value={rules.correctionIndex} onChange={(value) => change("correctionIndex", value)} options={indexOptions} /><IndexCompetenceField label="Competência inicial" indexLabel={rules.correctionIndex} value={rules.correctionStartDate || form.startDate} onChange={(value) => change("correctionStartDate", value)} /><IndexCompetenceField label="Competência final" indexLabel={rules.correctionIndex} value={rules.correctionEndDate || form.endDate} onChange={(value) => change("correctionEndDate", value)} /></div></div></div>
    <div className="rule-card"><div className="rule-number">2</div><div className="rule-body"><strong>Juros de poupança</strong><div className="salary-rule-fields"><SelectField label="Índice" value={rules.savingsIndex} onChange={(value) => change("savingsIndex", value)} options={indexOptions} /><IndexCompetenceField label="Competência inicial" indexLabel={rules.savingsIndex} value={rules.savingsStartDate || form.citationDate} onChange={(value) => change("savingsStartDate", value)} /><IndexCompetenceField label="Competência final" indexLabel={rules.savingsIndex} value={rules.savingsEndDate} onChange={(value) => change("savingsEndDate", value)} /></div></div></div>
    <div className="rule-card"><div className="rule-number">3</div><div className="rule-body"><strong>Selic</strong><div className="salary-rule-fields"><SelectField label="Índice" value={rules.selicIndex} onChange={(value) => change("selicIndex", value)} options={indexOptions} /><IndexCompetenceField label="Competência inicial" indexLabel={rules.selicIndex} value={rules.selicStartDate} onChange={(value) => change("selicStartDate", value)} /></div></div></div>
    <p className="section-description"><Info size={14} /> Para uma nova regra por período, adicione um novo cálculo para o período correspondente; a segmentação de índices dentro desta memória será adicionada na próxima evolução.</p>
  </div>;
}

function buildSalaryRules(rules, startDate, endDate) {
  const map = (label) => indexSlugs[label] ?? null;
  const date = (value, fallback) => value ? toIsoDate(value) : fallback;
  const correctionStartDate = date(rules.correctionStartDate, startDate);
  const correctionEndDate = date(rules.correctionEndDate, endDate);
  const savingsStartDate = date(rules.savingsStartDate, undefined);
  const savingsEndDate = date(rules.savingsEndDate, "2021-12-08");
  const selicStartDate = date(rules.selicStartDate, "2021-12-09");
  if (!map(rules.correctionIndex) || !map(rules.savingsIndex) || !map(rules.selicIndex) || !correctionStartDate || !correctionEndDate || !savingsEndDate || !selicStartDate || (rules.savingsStartDate && !savingsStartDate)) return null;
  return { correctionIndex: map(rules.correctionIndex), correctionStartDate, correctionEndDate, savingsIndex: map(rules.savingsIndex), ...(savingsStartDate ? { savingsStartDate } : {}), savingsEndDate, selicIndex: map(rules.selicIndex), selicStartDate };
}

function ResultStep({ form, result }) {
  if (!result || result.pending) {
    return <div className="step-content"><span className="result-icon pending"><Loader2 className="spinning" size={28} /></span><h2>Calculando...</h2>
      <p className="section-description">Montando a memória a partir dos dados e das séries oficiais do período {form.startDate} a {form.endDate}.</p></div>;
  }
  if (result.error) {
    return <div className="step-content"><span className="result-icon"><X size={28} /></span><h2>Cálculo não concluído</h2>
      <p className="section-description" role="alert">{result.error.message}</p></div>;
  }
  const isSchedule = result.data && (result.data.type === "sac" || result.data.type === "price");
  return <div className="step-content"><span className="result-icon"><Check size={28} /></span>
    <h2>{isSchedule ? "Memória de amortização preparada" : "Memória de cálculo preparada"}</h2>
    <p className="section-description">O resultado preserva os dados de entrada, as competências utilizadas e a versão de cada regra{result.data.type === "monetary" && (form.ruleChanges ?? []).length > 0 ? " — períodos com índices distintos acumulados em sequência." : "."}</p>
    <div className="export-row"><button className="secondary-button" type="button" onClick={() => downloadCalculationCsv({ ...result.data, title: form.title, calculationType: form.typeLabel })}><Download size={16} /> Baixar planilha (CSV)</button></div>
    {isSchedule
      ? <CalculationAmortizationTable data={result.data} ariaLabel={`Memória de amortização de ${form.typeLabel}`} />
      : <CalculationMemoryTable data={result.data} indexLabel={form.index} ariaLabel={`Memória de cálculo de ${form.typeLabel}`} />}
  </div>;
}

function calculationKey(form) {
  const changes = (form.ruleChanges ?? []).map((change) => `${change.date}@${change.index}`).join(",");
  return [form.type, form.amount, form.startDate, form.endDate, form.index, form.months, form.interest, form.salaryPrevious, form.salaryNew, JSON.stringify(form.salaryEntries), form.selicFactor, form.decimoTerceiro, form.vacationsWithBonus, changes].join("|");
}

function buildPayload(form) {
  const startDate = toIsoDate(form.startDate);
  const endDate = toIsoDate(form.endDate);
  if (!startDate || !endDate) return null;
  switch (form.type) {
    case "monetary": {
      const principalInCents = parseCurrencyToCents(form.amount);
      if (!principalInCents) return null;
      const indexSlug = indexSlugs[form.index] ?? "ipca";
      const changes = (form.ruleChanges ?? [])
        .map((change) => ({ date: toIsoDate(change.date), index: indexSlugs[change.index] ?? indexSlug }))
        .filter((change) => change.date);
      if (changes.length === 0) return { type: "monetary", principalInCents, indexSlug, startDate, endDate };
      if (changes.length !== (form.ruleChanges ?? []).length) return null;
      const dates = changes.map((change) => change.date);
      if (new Set(dates).size !== dates.length) return null;
      if (dates.some((date) => date <= startDate || date > endDate)) return null;
      changes.sort((a, b) => a.date.localeCompare(b.date));
      const segments = [{ indexSlug, startDate }];
      for (const change of changes) segments.push({ indexSlug: change.index, startDate: change.date });
      for (let index = 0; index < segments.length - 1; index += 1) segments[index].endDate = shiftDay(segments[index + 1].startDate, -1);
      segments[segments.length - 1].endDate = endDate;
      if (segments.some((segment) => segment.endDate < segment.startDate)) return null;
      return { type: "monetary", principalInCents, indexSlug, startDate, endDate, periods: segments };
    }
    case "sac":
    case "price": {
      const principalInCents = parseCurrencyToCents(form.amount);
      const months = parseInt(form.months, 10);
      const monthlyInterestRate = parsePercent(form.interest);
      if (!principalInCents || !(months > 0) || !Number.isFinite(monthlyInterestRate)) return null;
      const hasIndex = form.index !== "Sem correção";
      return { type: form.type, principalInCents, monthlyInterestRate, months, startDate, endDate, ...(hasIndex ? { indexSlug: indexSlugs[form.index] ?? "ipca" } : {}) };
    }
    case "salary": {
      const salaryPreviousInCents = parseCurrencyToCents(form.salaryPrevious);
      const salaryNewInCents = parseCurrencyToCents(form.salaryNew) ?? salaryPreviousInCents;
      const entries = parseSalaryEntries(form.salaryEntries, salaryPreviousInCents / 100);
      if (form.salaryEntries.length && !entries) return null;
      if (!salaryPreviousInCents || (!form.salaryEntries.length && salaryNewInCents <= salaryPreviousInCents)) return null;
      const citationDate = toIsoDate(form.citationDate);
      if (form.salaryEntries.length && !citationDate) return null;
      const rules = buildSalaryRules(form.salaryRules, startDate, endDate);
      if (form.salaryEntries.length && !rules) return null;
      return { type: "salary", salaryPreviousInCents, salaryNewInCents, decimoTerceiro: form.decimoTerceiro, vacationsWithBonus: form.vacationsWithBonus, indexSlug: indexSlugs[form.index] ?? "ipca_e", startDate, endDate, ...(entries ? { entries, citationDate, rules } : {}) };
    }
    case "judicial": {
      const principalInCents = parseCurrencyToCents(form.amount);
      if (!principalInCents) return null;
      const selic = parsePercent(form.selicFactor);
      return { type: "judicial", principalInCents, selicAccumulatedFactor: selic > 0 ? 1 + selic : undefined, startDate, endDate };
    }
    default:
      return null;
  }
}

function draftPayload(form) {
  const startDate = toIsoDate(form.startDate);
  const endDate = toIsoDate(form.endDate);
  if (!startDate || !endDate) return null;
  let principalInCents;
  if (form.type === "salary") {
    const previous = parseCurrencyToCents(form.salaryPrevious);
    const current = parseCurrencyToCents(form.salaryNew);
    if (!previous) return null;
    principalInCents = form.salaryEntries.length ? previous : current > previous ? current - previous : null;
  } else {
    principalInCents = parseCurrencyToCents(form.amount);
  }
  if (!principalInCents) return null;
  return {
    title: form.title.trim() || "Rascunho de cálculo",
    calculationType: form.typeLabel,
    clientId: form.clientId || undefined,
    processId: form.processId || undefined,
    status: "Rascunho",
    startDate,
    endDate,
    principalInCents,
    draftForm: form,
  };
}

function restoreDraftForm(draft) {
  const savedForm = draft.params?.draftForm;
  if (savedForm && typeof savedForm === "object" && calculationTypes.some((item) => item.id === savedForm.type)) {
    return {
      ...initialForm,
      ...savedForm,
      salaryRules: { ...initialForm.salaryRules, ...(savedForm.salaryRules ?? {}) },
      salaryEntries: Array.isArray(savedForm.salaryEntries) ? savedForm.salaryEntries : [],
      ruleChanges: Array.isArray(savedForm.ruleChanges) ? savedForm.ruleChanges : [],
    };
  }

  const type = calculationTypes.find((item) => item.label === draft.calculationType)?.id ?? "monetary";
  const date = (value) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "";
    return `${String(parsed.getUTCDate()).padStart(2, "0")}/${String(parsed.getUTCMonth() + 1).padStart(2, "0")}/${parsed.getUTCFullYear()}`;
  };
  const amount = maskCurrencyFromNumber((draft.principalInCents ?? 0) / 100);
  return {
    ...initialForm,
    type,
    typeLabel: calculationTypes.find((item) => item.id === type)?.label ?? initialForm.typeLabel,
    amount,
    salaryPrevious: type === "salary" ? amount : initialForm.salaryPrevious,
    title: draft.title ?? initialForm.title,
    startDate: date(draft.startDate),
    endDate: date(draft.endDate),
    clientId: draft.clientId ?? "",
    processId: draft.processId ?? "",
  };
}

function parseCurrencyToCents(value) {
  const normalized = String(value ?? "").replace(/\s*r\$\s*/gi, "").replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed * 100);
}

function parsePercent(value) {
  const normalized = String(value ?? "").trim().replace(/\s*%\s*$/g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed / 100 : NaN;
}

function parseSalaryEntries(entries, baseReceived) {
  if (!entries.length) return null;
  const parsed = [];
  for (const entry of entries) {
    const adjustment = parseBrazilianNumber(entry.adjustmentPercentage || "0");
    const vacation = parseBrazilianNumber(entry.vacationPercentage || "0");
    if (!entry.competence.trim() || !entry.description.trim() || adjustment == null || vacation == null) return null;
    const previous = parsed.at(-1);
    const previousSubsidy = [...parsed].reverse().find((item) => item.description === "Subsídio");
    if ((entry.description === "13º salário" || entry.description === "Adicional de férias") && !previous) return null;
    const calculatedReceived = entry.description === "13º salário" ? previous.receivedInCents / 100 : entry.description === "Adicional de férias" ? (previous.receivedInCents / 100) * vacation / 100 : baseReceived;
    const receivedOverride = parseBrazilianNumber(entry.receivedOverride);
    const received = receivedOverride == null ? calculatedReceived : receivedOverride;
    const dueOverride = parseBrazilianNumber(entry.dueOverride);
    const dueBase = previousSubsidy ? previousSubsidy.dueInCents / 100 : received;
    const due = entry.description === "13º salário" ? previous.dueInCents / 100 : entry.description === "Adicional de férias" ? (previous.dueInCents / 100) * vacation / 100 : dueBase * (1 + adjustment / 100);
    parsed.push({ competence: entry.competence.trim(), description: entry.description.trim(), dueInCents: (dueOverride == null ? due : dueOverride) * 100, receivedInCents: received * 100 });
  }
  return parsed;
}

function parseBrazilianNumber(value) {
  const normalized = String(value ?? "").trim().replace(/r\$\s*/gi, "").replace(/\./g, "").replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function maskCurrency(input) {
  const digits = String(input)
    .replace(/\D/g, "")
    .replace(/^0+(?=\d)/, "");
  if (!digits) return "";
  return maskCurrencyFromDigits(digits);
}

function maskCurrencyFromDigits(digits) {
  const cents = digits.padStart(3, "0");
  const whole = cents.slice(0, -2);
  const fraction = cents.slice(-2);
  return `R$ ${Number(whole).toLocaleString("pt-BR")},${fraction}`;
}

function maskCurrencyFromNumber(value) {
  const cents = Math.round(Number(value) * 100);
  return maskCurrencyFromDigits(String(cents));
}

function maskPercent(value) {
  return String(value).replace(".", ",");
}

function toIsoDate(value) {
  const match = String(value ?? "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
}

function shiftDay(isoDate, delta) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + delta));
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function oneMonthAfter(dateText) {
  const iso = toIsoDate(dateText);
  if (!iso) return dateText;
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month, Math.min(day, 28)));
  const pad = (value) => String(value).padStart(2, "0");
  return `${pad(date.getUTCDate())}/${pad(date.getUTCMonth() + 1)}/${date.getUTCFullYear()}`;
}

function parseCsvLancamentos(text) {
  const lines = String(text ?? "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return null;
  const rows = lines.map((line) => line.split(/[;,]/).map((cell) => cell.trim()).filter((cell) => cell !== ""));
  const first = rows[0] ?? [];
  const hasHeader = rows.length > 1 && first.length > 0 && first.every((cell) => /^[\p{L}\p{M}_% .()-]+$/u.test(normalizeWord(cell)));
  const body = hasHeader ? rows.slice(1) : rows;
  if (!body.length) return null;
  const headers = hasHeader ? first : [];

  const width = Math.max(...body.map((row) => row.length), 1);
  const columns = [];
  for (let index = 0; index < width; index += 1) {
    const cells = body.map((row) => row[index] ?? "").filter((cell) => cell !== "");
    const total = cells.length || 1;
    const dates = cells.filter((cell) => /^\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}$/.test(cell));
    const numerics = cells.filter((cell) => !/^\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}$/.test(cell) && parseNum(cell) != null);
    const label = normalizeWord(String(headers[index] ?? ""));
    columns.push({ dates, numerics, label, dateRatio: dates.length / total });
  }

  const dateIndex = columns.findIndex((column) => column.dateRatio >= 0.75);
  const preferred = ["valor", "principal", "prestacao", "parcela", "montante", "saldo", "juros", "taxa", "percentual", "%"];
  let numericIndex = -1;
  for (let index = 0; index < columns.length; index += 1) {
    if (index === dateIndex) continue;
    if (columns[index].numerics.length && preferred.some((word) => columns[index].label.includes(word))) { numericIndex = index; break; }
  }
  if (numericIndex === -1) {
    for (let index = 0; index < columns.length; index += 1) {
      if (index === dateIndex) continue;
      if (columns[index].numerics.length) { numericIndex = index; break; }
    }
  }
  const rateIndex = columns.findIndex((column) => column.numerics.length && (column.label.includes("juros") || column.label.includes("taxa") || column.label.includes("percentual") || column.label.includes("%")));

  const dates = dateIndex >= 0 ? columns[dateIndex].dates.map(parseDateStamp).filter((value) => value !== null).sort((a, b) => a - b) : [];
  const numbers = numericIndex >= 0 ? columns[numericIndex].numerics : [];
  const rates = rateIndex >= 0 ? columns[rateIndex].numerics : [];
  const amount = numbers.length && parseNum(numbers[0]) != null ? parseNum(numbers[0]) : null;
  const rate = rates.length && parseNum(rates[0]) != null ? parseNum(rates[0]) : null;
  if (amount == null && rate == null && !dates.length) return null;

  const format = (ms) => {
    const date = new Date(ms);
    const pad = (value) => String(value).padStart(2, "0");
    return `${pad(date.getUTCDate())}/${pad(date.getUTCMonth() + 1)}/${date.getUTCFullYear()}`;
  };
  return {
    amount,
    rate,
    startDate: dates.length ? format(dates[0]) : null,
    endDate: dates.length ? format(dates[dates.length - 1]) : null,
    rows: body.length,
  };
}

function parseDateStamp(value) {
  const match = String(value).match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})$/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = match[3].length === 2 ? Number(`20${match[3]}`) : Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(date.getTime()) || date.getUTCMonth() !== month - 1) return null;
  return date.getTime();
}

function parseNum(value) {
  const normalized = String(value ?? "").trim().replace(/\s*%\s*$/g, "").replace(/r\$\s*/gi, "").replace(/\s+/g, "");
  if (!normalized) return null;
  const parsed = Number(normalized.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeWord(value) {
  return String(value ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function IndexField({ form, update, withNone = false, label = "Indexador" }) {
  const options = [...(withNone ? ["Sem correção"] : []), "IPCA-E (IBGE)", "IPCA (IBGE)", "INPC (IBGE)", "IGP-M (FGV)", "TR (Bacen)", "Taxa Selic (Bacen)"];
  return <SelectField label={label} value={options.includes(form.index) ? form.index : options[0]} onChange={(value) => update("index", value)} options={options} />;
}

function IndexCompetenceField({ label, indexLabel, value, onChange }) {
  const slug = indexSlugs[indexLabel];
  const detail = useQuery({ queryKey: ["index-competences", slug], queryFn: () => api.get(`/api/indices/${slug}`), enabled: Boolean(slug) });
  const competences = (detail.data?.values ?? [])
    .filter((item) => item.published)
    .map((item) => ({ value: formatCompetenceDate(item.referenceDate), monthlyValue: item.monthlyValue, sortKey: item.referenceDate }))
    .sort((left, right) => String(right.sortKey).localeCompare(String(left.sortKey)));
  const currentMonth = competenceMonth(value);
  const selected = competences.find((item) => competenceMonth(item.value) === currentMonth) ?? competences[0];

  return <label className="field"><span>{label} <Info size={12} /></span><select value={selected?.value ?? ""} disabled={detail.isLoading || !competences.length} onChange={(event) => onChange(event.target.value)}>
    {!competences.length && <option value="">{detail.isLoading ? "Carregando competências..." : "Sem competências cadastradas"}</option>}
    {competences.map((item) => <option key={item.value} value={item.value}>{item.value} · {formatIndexRate(item.monthlyValue)}</option>)}
  </select></label>;
}

function formatCompetenceDate(value) {
  const date = new Date(value);
  return `${String(date.getUTCDate()).padStart(2, "0")}/${String(date.getUTCMonth() + 1).padStart(2, "0")}/${date.getUTCFullYear()}`;
}

function competenceMonth(value) {
  const match = String(value ?? "").trim().match(/^\d{1,2}\/(\d{1,2})\/(\d{4})$/);
  return match ? `${match[2]}-${match[1].padStart(2, "0")}` : null;
}

function formatIndexRate(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? `${numeric.toLocaleString("pt-BR", { maximumFractionDigits: 6 })}%` : "—";
}

function Field({ label, value, onChange = () => {}, icon: Icon, hint }) {
  return <label className="field"><span>{label} <Info size={12} /></span><div className="input-wrap"><input value={value} onChange={(event) => onChange(event.target.value)} />{Icon && <Icon size={17} />}</div>{hint && <small className="field-hint">{hint}</small>}</label>;
}

function NumberField({ label, value, onChange = () => {}, hint }) {
  return <label className="field"><span>{label} <Info size={12} /></span><div className="input-wrap"><input inputMode="decimal" value={value} onChange={(event) => onChange(event.target.value)} /></div>{hint && <small className="field-hint">{hint}</small>}</label>;
}

function MoneyField({ label, value, onChange = () => {}, icon: Icon, readOnly = false }) {
  return <label className="field"><span>{label} <Info size={12} /></span><div className="input-wrap"><input inputMode="numeric" readOnly={readOnly} value={value} onChange={(event) => onChange(maskCurrency(event.target.value))} />{Icon && <Icon size={17} />}</div></label>;
}

function SalaryEntriesEditor({ entries, salaryReceived, citationDate, onCitationDateChange, onChange }) {
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [repeatFrom, setRepeatFrom] = useState("");
  const [repeatTo, setRepeatTo] = useState("");
  const addEntry = () => onChange([...entries, { competence: "", description: "Subsídio", adjustmentPercentage: "0", vacationPercentage: "" }]);
  const updateEntry = (index, field, value) => onChange(entries.map((entry, current) => current === index ? { ...entry, [field]: value } : entry));
  const removeEntry = (index) => onChange(entries.filter((_, current) => current !== index));
  const duplicateEntry = (index) => onChange([...entries.slice(0, index + 1), { ...entries[index] }, ...entries.slice(index + 1)]);
  const insertEntryBelow = (index) => onChange([...entries.slice(0, index + 1), { competence: "", description: "Subsídio", adjustmentPercentage: "0", vacationPercentage: "" }, ...entries.slice(index + 1)]);
  const reorder = (targetIndex) => { if (draggedIndex == null || draggedIndex === targetIndex) return; const next = entries.slice(); const [item] = next.splice(draggedIndex, 1); next.splice(draggedIndex < targetIndex ? targetIndex - 1 : targetIndex, 0, item); onChange(next); setDraggedIndex(null); setDragOverIndex(null); };
  const repeatCompetences = () => {
    const from = competenceToMonth(repeatFrom);
    const to = competenceToMonth(repeatTo);
    if (!from || !to || from > to) return;
    const generated = [];
    for (let value = from; value <= to; value += 1) generated.push({ competence: monthToCompetence(value), description: "Subsídio", adjustmentPercentage: "0", vacationPercentage: "" });
    onChange([...entries, ...generated]);
    setRepeatFrom("");
    setRepeatTo("");
  };
  return <div className="section-block"><h2>Lançamentos detalhados</h2>
    <p className="section-description">Cadastre cada competência diretamente no sistema. Arraste pelo ícone para ordenar. O reajuste é aplicado aos valores-base; férias usa também o percentual informado. IPCA-E, poupança e Selic são buscados automaticamente.</p>
    <Field label="Data da citação" value={citationDate} onChange={onCitationDateChange} hint="Usada para iniciar a incidência dos juros de poupança." />
    <div className="salary-repeat"><Field label="Repetir competência de" value={repeatFrom} onChange={setRepeatFrom} /><Field label="até" value={repeatTo} onChange={setRepeatTo} /><button className="add-rule-button" type="button" onClick={repeatCompetences}>Gerar competências</button></div>
    {entries.map((entry, index) => { const values = entryValues(entries, index, salaryReceived); return <div className={`salary-entry-row ${dragOverIndex === index && draggedIndex !== index ? "drop-target" : ""}`} key={index} onDragOver={(event) => { event.preventDefault(); setDragOverIndex(index); }} onDragLeave={() => setDragOverIndex(null)} onDrop={() => reorder(index)}>
      <div className="salary-entry-fields">
        <button className="drag-handle" type="button" draggable onDragStart={() => setDraggedIndex(index)} onDragEnd={() => { setDraggedIndex(null); setDragOverIndex(null); }} aria-label={`Reordenar lançamento ${index + 1}`}><GripVertical size={18} /></button>
        <Field label="Competência (MM/AAAA)" value={entry.competence} onChange={(value) => updateEntry(index, "competence", value)} />
        <SelectField label="Evento" value={entry.description} onChange={(value) => updateEntry(index, "description", value)} options={["Subsídio", "13º salário", "Adicional de férias", "Outro"]} />
        {entry.description !== "13º salário" && entry.description !== "Adicional de férias" && <NumberField label="Reajuste (%)" value={entry.adjustmentPercentage ?? "0"} onChange={(value) => updateEntry(index, "adjustmentPercentage", value)} />}
        {entry.description === "Adicional de férias" && <NumberField label="Férias (%)" value={entry.vacationPercentage ?? ""} onChange={(value) => updateEntry(index, "vacationPercentage", value)} />}
        <MoneyField label="Valor devido" value={entry.dueOverride ?? values.due} onChange={(value) => updateEntry(index, "dueOverride", value)} />
        <MoneyField label="Valor recebido" value={entry.receivedOverride ?? values.received} onChange={(value) => updateEntry(index, "receivedOverride", value)} />
      </div>
      <div className="salary-entry-actions"><button className="icon-button" aria-label={`Adicionar lançamento abaixo de ${index + 1}`} type="button" onClick={() => insertEntryBelow(index)}><Plus size={16} /></button><button className="icon-button" aria-label={`Duplicar lançamento ${index + 1}`} type="button" onClick={() => duplicateEntry(index)}><Copy size={16} /></button><button className="icon-button rule-remove" aria-label={`Remover lançamento ${index + 1}`} type="button" onClick={() => removeEntry(index)}><Trash2 size={16} /></button></div>
    </div>})}
    <button className="add-rule-button" type="button" onClick={addEntry}>+ Adicionar lançamento</button>
  </div>;
}

function entryValues(entries, index, salaryReceived) {
  const entry = entries[index];
  const previous = index > 0 ? entryValues(entries, index - 1, salaryReceived) : null;
  if (entry.description === "13º salário" && previous) return { ...previous, received: entry.receivedOverride ?? previous.received };
  if (entry.description === "Adicional de férias" && previous) {
    const vacation = (parseBrazilianNumber(entry.vacationPercentage) ?? 0) / 100;
    return { due: maskCurrencyFromNumber((parseBrazilianNumber(previous.due) ?? 0) * vacation), received: entry.receivedOverride ?? maskCurrencyFromNumber((parseBrazilianNumber(previous.received) ?? 0) * vacation) };
  }
  const adjustment = parseBrazilianNumber(entry.adjustmentPercentage || "0") ?? 0;
  const received = parseBrazilianNumber(entry.receivedOverride ?? salaryReceived) ?? 0;
  const previousSubsidyIndex = entries.slice(0, index).map((item, current) => ({ item, current })).filter(({ item }) => item.description === "Subsídio").at(-1)?.current;
  const previousSubsidy = previousSubsidyIndex == null ? null : entryValues(entries, previousSubsidyIndex, salaryReceived);
  const dueBase = previousSubsidy ? parseBrazilianNumber(previousSubsidy.due) ?? received : received;
  return { due: entry.dueOverride ?? maskCurrencyFromNumber(dueBase * (1 + adjustment / 100)), received: entry.receivedOverride ?? maskCurrencyFromNumber(received) };
}

function competenceToMonth(value) {
  const match = String(value).trim().match(/^(\d{2})\/(\d{4})$/);
  if (!match || Number(match[1]) < 1 || Number(match[1]) > 12) return null;
  return Number(match[2]) * 12 + Number(match[1]) - 1;
}

function monthToCompetence(value) {
  const month = value % 12 + 1;
  const year = Math.floor(value / 12);
  return `${String(month).padStart(2, "0")}/${year}`;
}

function SelectField({ label, value, onChange, options }) {
  return <label className="field"><span>{label} <Info size={12} /></span><select value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option}>{option}</option>)}</select></label>;
}

function OptionSelectField({ label, value, onChange, options, placeholder = "Selecione...", disabled = false }) {
  return <label className="field"><span>{label} <Info size={12} /></span><select value={value ?? ""} disabled={disabled} onChange={(event) => onChange(event.target.value)}><option value="">{placeholder}</option>{options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>;
}
