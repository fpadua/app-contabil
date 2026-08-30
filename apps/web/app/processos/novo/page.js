"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "../../../components/app-shell";
import { FormActions, FormSection, RecordFormLayout } from "../../../components/record-form-layout";
import { readRecords, RECORD_KEYS, saveRecord } from "../../../lib/local-records";

const defaultClients = ["Cliente demonstrativo A", "Cliente demonstrativo B", "Cliente demonstrativo C", "Cliente demonstrativo D", "Empresa demonstrativa Ltda."];

export default function NewProcessPage() {
  const router = useRouter();
  const [clients, setClients] = useState(defaultClients);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const registeredClients = readRecords(RECORD_KEYS.clients).map((client) => client.name).filter(Boolean);
    setClients([...new Set([...registeredClients, ...defaultClients])]);
  }, []);

  function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    const data = new FormData(event.currentTarget);
    saveRecord(RECORD_KEYS.processes, {
      id: `process-${Date.now()}`,
      process: data.get("number") || data.get("title"),
      client: data.get("client"),
      type: data.get("type"),
      updated: new Date().toLocaleDateString("pt-BR"),
      status: data.get("status"),
    });
    router.push("/processos");
  }

  return (
    <AppShell>
      <RecordFormLayout eyebrow="GESTÃO" title="Novo processo" description="Registre uma demanda e organize os dados necessários para os cálculos." backHref="/processos" summaryTitle="Dados do processo" summaryItems={["Identificação e cliente", "Tipo de cálculo previsto", "Origem e situação atual"]}>
        <form onSubmit={handleSubmit}>
          <FormSection number="1" title="Dados principais" description="Use uma identificação que facilite localizar este processo depois.">
            <div className="fields-grid compact">
              <label className="field field-wide"><span>Título do processo *</span><input autoFocus name="title" placeholder="Ex.: Revisão de contrato habitacional" required /></label>
              <label className="field"><span>Número do processo ou contrato</span><input name="number" placeholder="0000000-00.0000.0.00.0000" /></label>
              <label className="field"><span>Cliente *</span><select defaultValue="" name="client" required><option disabled value="">Selecione um cliente</option>{clients.map((client) => <option key={client}>{client}</option>)}</select></label>
            </div>
          </FormSection>
          <FormSection number="2" title="Classificação" description="Essas informações ajudam a organizar o trabalho e os cálculos vinculados.">
            <div className="fields-grid compact">
              <label className="field"><span>Tipo de cálculo *</span><select defaultValue="" name="type" required><option disabled value="">Selecione o tipo</option><option>Correção monetária</option><option>Cálculo judicial</option><option>Financiamento SAC</option><option>Diferença salarial</option><option>Outro</option></select></label>
              <label className="field"><span>Situação</span><select defaultValue="Em andamento" name="status"><option>Em andamento</option><option>Em revisão</option><option>Concluído</option></select></label>
              <label className="field"><span>Tribunal ou órgão</span><input name="court" placeholder="Ex.: TJGO" /></label>
              <label className="field"><span>Vara ou unidade</span><input name="division" placeholder="Ex.: 2ª Vara Cível" /></label>
              <label className="field field-wide"><span>Observações</span><textarea name="notes" placeholder="Descreva o objetivo do processo ou informações importantes." rows="4" /></label>
            </div>
          </FormSection>
          <FormActions cancelHref="/processos" submitLabel="Salvar processo" submitting={submitting} />
        </form>
      </RecordFormLayout>
    </AppShell>
  );
}
