import { BarChart3, BriefcaseBusiness, Calculator, CircleHelp, FileText, Home, Users } from "lucide-react";

const navigation = [
  { label: "Painel", icon: Home },
  { label: "Novo cálculo", icon: Calculator, active: true },
  { label: "Processos", icon: BriefcaseBusiness },
  { label: "Índices", icon: BarChart3 },
  { label: "Clientes", icon: Users },
  { label: "Documentos", icon: FileText },
];

export function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="brand"><span>Contábil</span><small>CÁLCULOS CONTÁBEIS E JUDICIAIS</small></div>
      <nav aria-label="Navegação principal">
        {navigation.map(({ label, icon: Icon, active }) => (
          <button className={`nav-item ${active ? "active" : ""}`} key={label} type="button">
            <Icon size={20} strokeWidth={1.7} /><span>{label}</span>
          </button>
        ))}
      </nav>
      <div className="trust-card"><span className="quote">“</span><p>Precisão técnica, segurança jurídica e clareza em cada cálculo.</p><div className="leaf-mark">⌁</div></div>
      <div className="support"><CircleHelp size={32} /><div><strong>Precisa de ajuda?</strong><span>Fale com o suporte</span></div></div>
    </aside>
  );
}
