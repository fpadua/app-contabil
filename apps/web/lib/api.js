const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

async function request(path, options = {}) {
  const headers = { ...(options.headers ?? {}) };
  if (options.body != null) headers["Content-Type"] = "application/json";
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers,
  });
  if (response.status === 204) return null;
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.message
      ?? (payload?.code === "MISSING_INDEX_PERIODS" ? `Competências não publicadas para o período: ${(payload.missingPeriods ?? []).join(", ")}` : undefined)
      ?? payload?.issues?.map?.((issue) => issue.message).join(" ")
      ?? `Erro ${response.status}`;
    throw new Error(message);
  }
  return payload;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: "POST", body: JSON.stringify(body) }),
  put: (path, body) => request(path, { method: "PUT", body: JSON.stringify(body) }),
  delete: (path) => request(path, { method: "DELETE" }),
};

export function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("pt-BR");
}

export function formatRequired(value) {
  return value || "—";
}

export function formatCurrency(cents) {
  return currency.format(cents / 100);
}

export function formatFactor(value) {
  return Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 6 });
}

export function safeSlug(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

export async function downloadFile(path, filename) {
  const response = await fetch(`${apiUrl}${path}`);
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.message ?? payload?.code ?? `Erro ${response.status}`);
  }
  const blob = await response.blob();
  triggerDownload(blob, filename);
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
