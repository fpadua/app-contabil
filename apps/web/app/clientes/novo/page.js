"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "../../../components/app-shell";
import { FormActions, FormSection, RecordFormLayout } from "../../../components/record-form-layout";
import { api } from "../../../lib/api";

export default function NewClientPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [personType, setPersonType] = useState("Pessoa física");
  const [formError, setFormError] = useState("");
  const create = useMutation({
    mutationFn: (data) => api.post("/api/clients", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      router.push("/clientes");
    },
    onError: (error) => setFormError(error.message),
  });

  function handleSubmit(event) {
    event.preventDefault();
    setFormError("");
    const data = new FormData(event.currentTarget);
    create.mutate({
      personType,
      name: data.get("name"),
      document: data.get("document"),
      email: data.get("email"),
      phone: data.get("phone"),
      notes: data.get("notes"),
      status: data.get("status"),
    });
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
          {formError && <p className="field-error" role="alert">{formError}</p>}
          <FormActions cancelHref="/clientes" submitLabel="Salvar cliente" submitting={create.isPending} />
        </form>
      </RecordFormLayout>
    </AppShell>
  );
}