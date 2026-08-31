"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, BriefcaseBusiness, Calculator, CircleHelp, FileText, Files, Home, Users } from "lucide-react";

const navigation = [
  { label: "Painel", icon: Home, href: "/painel" },
  { label: "Novo cálculo", icon: Calculator, href: "/calculos/novo" },
  { label: "Cálculos", icon: Files, href: "/calculos" },
  { label: "Processos", icon: BriefcaseBusiness, href: "/processos" },
  { label: "Índices", icon: BarChart3, href: "/indices" },
  { label: "Clientes", icon: Users, href: "/clientes" },
  { label: "Documentos", icon: FileText, href: "/documentos" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <div className="brand"><span>Contábil</span><small>CÁLCULOS CONTÁBEIS E JUDICIAIS</small></div>
      <nav aria-label="Navegação principal">
        {navigation.map(({ label, icon: Icon, href }) => (
          <Link className={`nav-item ${pathname === href || (href !== "/painel" && pathname.startsWith(`${href}/`) && !navigation.some((n) => n.href !== href && pathname === n.href)) ? "active" : ""}`} href={href} key={label}>
            <Icon size={20} strokeWidth={1.7} /><span>{label}</span>
          </Link>
        ))}
      </nav>
      <div className="trust-card"><span className="quote">“</span><p>Precisão técnica, segurança jurídica e clareza em cada cálculo.</p><div className="leaf-mark">⌁</div></div>
      <div className="support"><CircleHelp size={32} /><div><strong>Precisa de ajuda?</strong><span>Fale com o suporte</span></div></div>
    </aside>
  );
}
