const { chromium } = require("playwright");

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const API = process.env.E2E_API_URL ?? "http://localhost:3333";
const stamp = Date.now();
const clientName = `E2E Cliente ${stamp}`;
const processTitle = `E2E Processo ${stamp}`;
const calcTitle = `E2E Cálculo ${stamp}`;

const results = [];
const ok = (cond, label) => {
  results.push(`${cond ? "✓" : "✖"} ${label}`);
  if (!cond) process.exitCode = 1;
};

async function api(method, path, body) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const res = await fetch(`${API}${path}`, body ? { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : { method });
      const text = await res.text();
      return text ? JSON.parse(text) : null;
    } catch (error) {
      if (attempt === 4) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  return null;
}

async function newCalcTitle(page, name) {
  await page.goto(`${BASE}/calculos/novo`);
  await page.getByRole("button", { name: /Correção monetária/ }).click();
  await page.click("text=Avançar");
  await page.getByText("Informe os dados do cálculo").waitFor({ timeout: 10000 });
  await page.getByLabel("Identificação do contrato ou processo").fill(name);
  await page.click("text=Avançar");
  await page.getByText("Defina as regras de atualização").waitFor({ timeout: 10000 });
  await page.click("text=Avançar");
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // ── 1) Criar cliente pelo fluxo web ─────────────────────────────
  await page.goto(`${BASE}/clientes/novo`);
  await page.getByLabel("Nome completo *").fill(clientName);
  await page.getByLabel("CPF *").fill("111.222.333-44");
  await page.getByLabel("E-mail *").fill(`e2e${stamp}@exemplo.com`);
  await page.getByRole("button", { name: "Salvar cliente" }).click();
  await page.waitForURL("**/clientes");
  await page.getByText(clientName).first().waitFor({ timeout: 15000 });
  ok(true, "Criou cliente pela interface");
  const clients = await api("GET", "/api/clients");
  const client = clients.find((c) => c.name === clientName);
  ok(Boolean(client), "Localizou id do cliente pela API");
  const clientId = client.id;

  // ── 2) Criar processo vinculado ao cliente ──────────────────────
  await page.goto(`${BASE}/processos/novo`);
  await page.getByLabel("Título do processo *").fill(processTitle);
  await page.getByLabel("Número do processo ou contrato").fill("0000000-00.2026");
  await page.getByLabel("Cliente *").selectOption({ label: clientName });
  await page.getByLabel("Tipo de cálculo *").selectOption({ label: "Correção monetária" });
  await page.getByRole("button", { name: "Salvar processo" }).click();
  await page.waitForURL("**/processos");
  await page.getByText(processTitle).first().waitFor({ timeout: 15000 });
  ok(true, "Criou processo pela interface vinculado ao cliente");
  const processes = await api("GET", "/api/processes");
  const proc = processes.find((p) => p.title === processTitle);
  ok(Boolean(proc), "Localizou id do processo pela API");
  const processId = proc.id;

  // ── 3) Rodar cálculo monetário no assistente e salvar ───────────
  await newCalcTitle(page, calcTitle);
  await page.getByText("Memória de cálculo preparada").waitFor({ timeout: 20000 });
  ok(true, "Assistente gerou memória de cálculo");
  await page.getByRole("button", { name: "Salvar cálculo" }).click();
  await page.waitForURL("**/calculos");
  await page.getByText(calcTitle).first().waitFor({ timeout: 15000 });
  ok(true, "Salvou o cálculo pela interface");
  const calcs = await api("GET", "/api/calculations");
  const calc = calcs.find((c) => c.title === calcTitle);
  ok(Boolean(calc), "Localizou id do cálculo pela API");
  const calcId = calc.id;

  // ── 4) Editar vínculo do cálculo (cliente + processo) ───────────
  await page.goto(`${BASE}/calculos/${calcId}`);
  await page.getByRole("button", { name: "Editar vínculo" }).click();
  await page.getByLabel("Processo").waitFor({ timeout: 5000 });
  await page.getByLabel("Cliente").selectOption({ label: clientName });
  await page.getByLabel("Processo").selectOption({ value: processId });
  await page.getByRole("button", { name: "Salvar vínculo" }).click();
  try {
    await page.getByText("Vínculo atualizado").waitFor({ timeout: 8000 });
  } catch (_error) {
    await page.screenshot({ path: "e2e/failure-link.png", fullPage: true });
    const errs = await page.locator(".field-error, .module-status.error").allTextContents();
    console.log("DIAG link save errors:", errs);
    throw new Error("Vínculo atualizado não apareceu após salvar");
  }
  const linked = await api("GET", `/api/calculations/${calcId}`);
  ok(linked.clientId === clientId, "Cálculo vinculado ao cliente");
  ok(linked.processId === processId, "Cálculo vinculado ao processo");

  // ── 5) Página do cliente mostra processo e cálculo vinculados ──
  await page.goto(`${BASE}/clientes/${clientId}`);
  await page.getByText(calcTitle).first().waitFor({ timeout: 10000 });
  ok(true, "Página do cliente lista o cálculo vinculado");
  await page.getByText(processTitle).first().waitFor({ timeout: 5000 });
  ok(true, "Página do cliente lista o processo vinculado");

  // ── 6) Editar dados do cliente na página de detalhe ───────────
  await page.getByRole("button", { name: "Editar cliente" }).click();
  await page.locator(".link-editor input[name='phone']").fill("(62) 90000-0000");
  await page.locator(".link-editor").getByRole("button", { name: "Salvar alterações" }).click();
  await page.getByText("90000-0000").waitFor({ timeout: 10000 });
  ok(true, "Editou dados do cliente pela interface");

  // ── 7) Desvincular cálculo via página do cálculo ───────────────
  await page.goto(`${BASE}/calculos/${calcId}`);
  await page.getByRole("button", { name: "Editar vínculo" }).click();
  await page.getByLabel("Cliente").selectOption({ label: "Sem vínculo" });
  await page.getByLabel("Processo").selectOption({ label: "Sem vínculo" });
  await page.getByRole("button", { name: "Salvar vínculo" }).click();
  await page.getByText("Vínculo atualizado").waitFor({ timeout: 10000 });
  const unlinked = await api("GET", `/api/calculations/${calcId}`);
  ok(unlinked.clientId === null && unlinked.processId === null, "Desvinculou o cálculo da interface");

  await browser.close();
  console.log("\n" + results.join("\n"));
  if (process.exitCode) { console.log("\nFALHAS"); process.exit(1); }
  console.log("\nE2E OK");
})().catch((error) => {
  console.error("\nErro durante E2E:", error);
  process.exit(1);
});
