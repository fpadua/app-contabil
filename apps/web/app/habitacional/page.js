import { Suspense } from "react";
import { AppShell } from "../../components/app-shell";
import { HousingPlanilha } from "../../components/housing-planilha";

export default function HousingPage() { return <AppShell><Suspense fallback={null}><HousingPlanilha /></Suspense></AppShell>; }
