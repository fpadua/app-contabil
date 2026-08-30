import { Sidebar } from "./sidebar";

export function AppShell({ children }) {
  return <main className="app-shell"><Sidebar />{children}</main>;
}
