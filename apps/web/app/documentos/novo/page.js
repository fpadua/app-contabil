"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, UploadCloud, X } from "lucide-react";
import { AppShell } from "../../../components/app-shell";
import { FormActions, FormSection, RecordFormLayout } from "../../../components/record-form-layout";
import { api } from "../../../lib/api";

export default function NewDocumentPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const create = useMutation({
    mutationFn: (data) => api.post("/api/documents", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      router.push("/documentos");
    },
    onError: (creationError) => setFormError(creationError.message),
  });

  function chooseFile(selectedFile) {
    setError("");
    if (!selectedFile) return;
    if (selectedFile.size > 20 * 1024 * 1024) {
      setFile(null);
      setError("O arquivo deve ter no máximo 20 MB.");
      return;
    }
    setFile(selectedFile);
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (!file) {
      setError("Selecione um arquivo para continuar.");
      inputRef.current?.focus();
      return;
    }
    setFormError("");
    const data = new FormData(event.currentTarget);
    create.mutate({
      title: data.get("title") || file.name,
      category: data.get("category"),
      description: data.get("description"),
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      source: data.get("source") || null,
      status: "Em revisão",
    });
  }

  return (
    <AppShell>
      <RecordFormLayout eyebrow="ARQUIVOS" title="Novo documento" description="Adicione um arquivo e identifique onde ele será utilizado." backHref="/documentos" summaryTitle="Envio do documento" summaryItems={["Arquivo de até 20 MB", "Categoria e identificação", "Vínculo opcional com processo"]}>
        <form onSubmit={handleSubmit}>
          <FormSection number="1" title="Selecionar arquivo" description="Formatos aceitos: PDF, DOC, DOCX, XLS, XLSX, PNG e JPG.">
            <input accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg" className="sr-only" onChange={(event) => chooseFile(event.target.files?.[0])} ref={inputRef} type="file" />
            {!file ? (
              <button className="upload-zone" onClick={() => inputRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); chooseFile(event.dataTransfer.files?.[0]); }} type="button">
                <UploadCloud size={30} /><strong>Arraste o arquivo ou clique para selecionar</strong><span>O arquivo não pode ultrapassar 20 MB</span>
              </button>
            ) : (
              <div className="selected-file"><div><FileText size={22} /><span><strong>{file.name}</strong><small>{formatBytes(file.size)}</small></span></div><button aria-label="Remover arquivo" onClick={() => { setFile(null); if (inputRef.current) inputRef.current.value = ""; }} type="button"><X size={17} /></button></div>
            )}
            {error && <p className="field-error" role="alert">{error}</p>}
          </FormSection>
          <FormSection number="2" title="Informações do documento" description="Preencha os dados usados na consulta e organização do arquivo.">
            <div className="fields-grid compact">
              <label className="field field-wide"><span>Título</span><input name="title" placeholder="Se ficar em branco, será usado o nome do arquivo" /></label>
              <label className="field"><span>Categoria *</span><select defaultValue="" name="category" required><option disabled value="">Selecione uma categoria</option><option>Contrato</option><option>Relatório</option><option>Planilha</option><option>Petição</option><option>Comprovante</option><option>Outro</option></select></label>
              <label className="field"><span>Vinculado a</span><input name="source" placeholder="Ex.: Processo 042" /></label>
              <label className="field field-wide"><span>Descrição</span><textarea name="description" placeholder="Inclua observações sobre o conteúdo do arquivo." rows="4" /></label>
            </div>
          </FormSection>
          {formError && <p className="field-error" role="alert">{formError}</p>}
          <FormActions cancelHref="/documentos" submitLabel="Salvar documento" submitting={create.isPending} />
        </form>
      </RecordFormLayout>
    </AppShell>
  );
}

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}