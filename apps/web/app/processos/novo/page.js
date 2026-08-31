"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "../../../components/app-shell";
import { FormActions, FormSection, RecordFormLayout } from "../../../components/record-form-layout";
import { api } from "../../../lib/api";

export default function NewProcessPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState("");
  const clientsQuery = useQuery({ queryKey: ["client-options"], queryFn: () => api.get("/api/clients/options") });
  const create = useMutation({
    mutationFn: (data) => api.post("/api/processes", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["processes"] });
      router.push("/processos");
    },
    onError: (error) => setFormError(error.message),
  });

  function handleSubmit(event) {
    event.preventDefault();
    setFormError("");
    const data = new FormData(event.currentTarget);
    create.mutate({
      clientId: data.get("client") || undefined,
      title: data.get("title"),
      number: data.get("number"),
      calculationType: data.get("type"),
      status: data.get("status"),
      court: data.get("court"),
      division: data.get("division"),
      notes: data.get("notes"),
    });
  }

  const statusMessage = clientsQuery.isLoading ? "Carregando clientes..." : clientsQuery.isError ? "Não foi possível carregar os clientes. Verifique se a API está em execução." : null;

  return (
    <AppShell>
      <RecordFormLayout eyebrow="GESTÃO" title="Novo processo" description="Registre uma demanda e organize os dados necessários para os cálculos." backHref="/processos" summaryTitle="Dados do processo" summaryItems={["Identificação e cliente", "Tipo de cálculo previsto", "Origem e situação atual"]}>
        <form onSubmit={handleSubmit}>
          {statusMessage && <p className="module-status" role="status">{statusMessage}</p>}
          <FormSection number="1" title="Dados principais" description="Use uma identificação que facilite localizar este processo depois.">
            <div className="fields-grid compact">
              <label className="field field-wide"><span>Título do processo *</span><input autoFocus name="title" placeholder="Ex.: Revisão de contrato habitacional" required /></label>
              <label className="field"><span>Número do processo ou contrato</span><input name="number" placeholder="0000000-00.0000.0.00.0000" /></label>
              <label className="field"><span>Cliente *</span><select defaultValue="" name="client" required><option disabled value="">Selecione um cliente</option>{(clientsQuery.data ?? []).map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label>
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
          {formError && <p className="field-error" role="alert">{formError}</p>}
          <FormActions cancelHref="/processos" submitLabel="Salvar processo" submitting={create.isPending} />
        </form>
      </RecordFormLayout>
    </AppShell>
  );
}