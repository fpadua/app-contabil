"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "../../../components/app-shell";
import { FormActions, FormSection, RecordFormLayout } from "../../../components/record-form-layout";
import { RECORD_KEYS, saveRecord } from "../../../lib/local-records";

export default function NewClientPage() {
  const router = useRouter();
  const [personType, setPersonType] = useState("Pessoa física");
  const [submitting, setSubmitting] = useState(false);

  function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    const data = new FormData(event.currentTarget);
    saveRecord(RECORD_KEYS.clients, {
      id: `client-${Date.now()}`,
      name: data.get("name"),
      document: data.get("document"),
      processes: "0",
      lastActivity: "Agora",
      status: data.get("status"),
      email: data.get("email"),
      phone: data.get("phone"),
    });
    router.push("/clientes");
  }

  return (
    <AppShell>
      <RecordFormLayout eyebrow="CADASTROS" title="Novo cliente" description="Cadastre os dados essenciais para vincular processos e documentos." backHref="/clientes" summaryTitle="Cadastro do cliente" summaryItems={["Dados pessoais ou empresariais", "Informações de contato", "Situação do cadastro"]}>
        <form onSubmit={handleSubmit}>
          <FormSection number="1" title="Identificação" description="Informe como o cliente será identificado no sistema.">
            <div className="choice-group" aria-label="Tipo de pessoa">
              {["Pessoa física", "Pessoa jurídica"].map((type) => <button className={personType === type ? "active" : ""} key={type} onClick={() => setPersonType(type)} type="button">{type}</button>)}
            </div>
            <div className="fields-grid compact">
              <label className="field field-wide"><span>{personType === "Pessoa física" ? "Nome completo" : "Razão social"} *</span><input autoFocus name="name" placeholder={personType === "Pessoa física" ? "Ex.: Maria da Silva" : "Ex.: Empresa Silva Ltda."} required /></label>
              <label className="field"><span>{personType === "Pessoa física" ? "CPF" : "CNPJ"} *</span><input inputMode="numeric" name="document" placeholder={personType === "Pessoa física" ? "000.000.000-00" : "00.000.000/0000-00"} required /></label>
              <label className="field"><span>Situação</span><select defaultValue="Ativo" name="status"><option>Ativo</option><option>Inativo</option></select></label>
            </div>
          </FormSection>
          <FormSection number="2" title="Contato" description="Dados usados nas comunicações relacionadas ao atendimento.">
            <div className="fields-grid compact">
              <label className="field"><span>E-mail *</span><input name="email" placeholder="cliente@email.com" required type="email" /></label>
              <label className="field"><span>Telefone</span><input inputMode="tel" name="phone" placeholder="(62) 99999-9999" /></label>
              <label className="field field-wide"><span>Observações</span><textarea name="notes" placeholder="Inclua informações adicionais, se necessário." rows="4" /></label>
            </div>
          </FormSection>
          <FormActions cancelHref="/clientes" submitLabel="Salvar cliente" submitting={submitting} />
        </form>
      </RecordFormLayout>
    </AppShell>
  );
}
