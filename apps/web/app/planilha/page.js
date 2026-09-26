import { Suspense } from "react";
import { AppShell } from "../../components/app-shell";
import { SalaryPlanilha } from "../../components/salary-planilha";

export default function PlanilhaPage() {
  return <AppShell><Suspense fallback={null}><SalaryPlanilha /></Suspense></AppShell>;
}
