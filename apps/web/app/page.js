import { Sidebar } from "../components/sidebar";
import { CalculationWizard } from "../components/calculation-wizard";

export default function Home() {
  return <main className="app-shell"><Sidebar /><CalculationWizard /></main>;
}
