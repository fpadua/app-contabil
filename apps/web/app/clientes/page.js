import { AppShell } from "../../components/app-shell";
import { ModulePage } from "../../components/module-page";

const columns = [
  { key: "name", label: "Nome", width: "1.5fr" },
  { key: "document", label: "Documento" },
  { key: "processes", label: "Processos" },
  { key: "lastActivity", label: "Última atividade" },
  { key: "status", label: "Situação" },
];
const rows = [
  { id: 1, name: "Cliente demonstrativo A", document: "***.***.***-01", processes: "3", lastActivity: "Hoje, 10:32", status: "Ativo" },
  { id: 2, name: "Cliente demonstrativo B", document: "***.***.***-02", processes: "1", lastActivity: "29/08/2026", status: "Ativo" },
  { id: 3, name: "Empresa demonstrativa Ltda.", document: "**.***.***/0001-03", processes: "4", lastActivity: "27/08/2026", status: "Ativo" },
];

export default function ClientsPage() {
  return <AppShell><ModulePage eyebrow="CADASTROS" title="Clientes" description="Centralize clientes e consulte os processos vinculados." actionLabel="Novo cliente" columns={columns} rows={rows} stats={[{ label: "Clientes ativos", value: "27", hint: "+2 no mês" }, { label: "Com processos", value: "19", hint: "70% da base" }, { label: "Novos cadastros", value: "4", hint: "Últimos 30 dias" }]} /></AppShell>;
}
