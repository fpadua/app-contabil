"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BarChart3, BriefcaseBusiness, CircleHelp, Files, Home, Landmark, Menu, Table2, Users, X } from "lucide-react";

const navigation = [
  { label: "Painel", icon: Home, href: "/painel" },
  // { label: "Novo cálculo", icon: Calculator, href: "/calculos/novo" },
  { label: "Diferença Salarial", icon: Table2, href: "/planilha" },
  { label: "SAC Habitacional", icon: Landmark, href: "/habitacional" },
  { label: "Cálculos", icon: Files, href: "/calculos" },
  { label: "Processos", icon: BriefcaseBusiness, href: "/processos" },
  { label: "Índices", icon: BarChart3, href: "/indices" },
  { label: "Clientes", icon: Users, href: "/clientes" },
  // { label: "Documentos", icon: FileText, href: "/documentos" },
];

export function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => setIsOpen(false), [pathname]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <>
      <button aria-controls="main-navigation" aria-expanded={isOpen} aria-label="Abrir menu" className="mobile-menu-trigger" onClick={() => setIsOpen(true)} type="button"><Menu size={21} /></button>
      <button aria-label="Fechar menu" className={`sidebar-backdrop ${isOpen ? "visible" : ""}`} onClick={() => setIsOpen(false)} tabIndex={isOpen ? 0 : -1} type="button" />
      <aside className={`sidebar ${isOpen ? "is-open" : ""}`} id="main-navigation">
        <div className="sidebar-heading">
          <div className="brand"><span>Contábil</span><small>CÁLCULOS CONTÁBEIS E JUDICIAIS</small></div>
          <button aria-label="Fechar menu" className="mobile-menu-close" onClick={() => setIsOpen(false)} type="button"><X size={21} /></button>
        </div>
        <nav aria-label="Navegação principal">
          {navigation.map(({ label, icon: Icon, href }) => {
            const isActive = pathname === href || (href !== "/painel" && pathname.startsWith(`${href}/`) && !navigation.some((item) => item.href !== href && pathname === item.href));
            return <Link aria-current={isActive ? "page" : undefined} className={`nav-item ${isActive ? "active" : ""}`} href={href} key={label}>
              <Icon size={20} strokeWidth={1.7} /><span>{label}</span><small className="nav-item-arrow">›</small>
            </Link>;
          })}
        </nav>
        <div className="trust-card"><span className="quote">“</span><p>Precisão técnica, segurança jurídica e clareza em cada cálculo.</p><div className="leaf-mark">⌁</div></div>
        <div className="support"><CircleHelp size={32} /><div><strong>Precisa de ajuda?</strong><span>Fale com o suporte</span></div></div>
      </aside>
    </>
  );
}
