import { Suspense } from "react";
import { AppShell } from "../../../components/app-shell";
import { CalculationWizard } from "../../../components/calculation-wizard";

export default function NewCalculationPage() {
  return <AppShell><Suspense fallback={null}><CalculationWizard /></Suspense></AppShell>;
}
