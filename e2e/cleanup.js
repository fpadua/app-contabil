const API = "http://localhost:3333";
async function req(method, p, b) {
  const r = await fetch(API + p, b ? { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) } : { method });
  const t = await r.text();
  let j = null;
  try { j = t ? JSON.parse(t) : null; } catch {}
  return { status: r.status, json: j };
}
(async () => {
  const clients = (await req("GET", "/api/clients")).json.filter((c) => (c.name || "").startsWith("E2E ") || (c.name || "").startsWith("DBG ") || (c.name || "").startsWith("UPL "));
  const procs = (await req("GET", "/api/processes")).json.filter((p) => (p.title || "").startsWith("E2E ") || (p.title || "").startsWith("DBG ") || (p.title || "").startsWith("UPL "));
  const calcs = (await req("GET", "/api/calculations")).json.filter((c) => (c.title || "").startsWith("E2E ") || (c.title || "").startsWith("DBG ") || (c.title || "").startsWith("UPL "));
  let removedCalcs = 0, removedClients = 0, removedProcs = 0;
  for (const c of calcs) { const r = await req("DELETE", "/api/calculations/" + c.id); if (r.status < 300) removedCalcs++; else console.log("calc del fail", c.id, r.status); }
  for (const p of procs) { const r = await req("DELETE", "/api/processes/" + p.id); if (r.status < 300) removedProcs++; else console.log("proc del fail", p.id, r.status); }
  for (const c of clients) { const r = await req("DELETE", "/api/clients/" + c.id); if (r.status < 300) removedClients++; else console.log("client del fail", c.id, r.status); }
  console.log("removed calcs", removedCalcs, "procs", removedProcs, "clients", removedClients);
})();
