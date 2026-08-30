import { AppShell } from "../../components/app-shell";
import { ModulePage } from "../../components/module-page";

const columns = [
  { key: "index", label: "Índice", width: "1.1fr" },
  { key: "reference", label: "Competência" },
  { key: "monthly", label: "Variação mensal" },
  { key: "accumulated", label: "Acumulado 12 meses" },
  { key: "source", label: "Fonte" },
  { key: "status", label: "Situação" },
];
const rows = [
  { id: 1, index: "IPCA", reference: "07/2026", monthly: "0,07%", accumulated: "—", source: "IBGE", status: "Atualizado" },
  { id: 2, index: "INPC", reference: "07/2026", monthly: "-0,01%", accumulated: "—", source: "IBGE", status: "Atualizado" },
  { id: 3, index: "IGP-M", reference: "07/2026", monthly: "-1,16%", accumulated: "2,77%", source: "FGV", status: "Atualizado" },
  { id: 4, index: "Selic", reference: "07/2026", monthly: "1,22%", accumulated: "—", source: "Bacen", status: "Atualizado" },
  { id: 5, index: "TR", reference: "08/2026", monthly: "0,1693%", accumulated: "—", source: "Bacen", status: "Atualizado" },
];

export default function IndicesPage() {
  return <AppShell><ModulePage eyebrow="BASE ECONÔMICA" title="Índices econômicos" description="Consulte competências, fontes e o estado das séries utilizadas nos cálculos." actionLabel="Atualizar índices" actionIcon="refresh" columns={columns} rows={rows} stats={[{ label: "Índices ativos", value: "5", hint: "IPCA, INPC, IGP-M, Selic e TR" }, { label: "Última verificação", value: "Hoje", hint: "08:35" }, { label: "Pendências", value: "0", hint: "Todas as séries disponíveis" }]} /></AppShell>;
}
