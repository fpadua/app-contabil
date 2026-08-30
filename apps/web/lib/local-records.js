export const RECORD_KEYS = {
  processes: "contabil:processes",
  clients: "contabil:clients",
  documents: "contabil:documents",
};

export function readRecords(key) {
  if (typeof window === "undefined") return [];

  try {
    const value = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function saveRecord(key, record) {
  const current = readRecords(key);
  window.localStorage.setItem(key, JSON.stringify([record, ...current]));
}
