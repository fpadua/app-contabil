import "./globals.css";
import { Providers } from "./providers";

export const metadata = {
  title: "Contábil — Cálculos contábeis e judiciais",
  description: "Cálculos auditáveis com índices econômicos e memória detalhada.",
};

export default function RootLayout({ children }) {
  return <html lang="pt-BR"><body><Providers>{children}</Providers></body></html>;
}
