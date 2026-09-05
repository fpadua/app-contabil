import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const rootEnvironmentFile = fileURLToPath(new URL("../../.env", import.meta.url));

for (const line of readFileSync(rootEnvironmentFile, "utf8").split(/\r?\n/)) {
  const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (!match || process.env[match[1]] !== undefined) continue;
  process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
}

function originHost(origin) {
  try {
    return new URL(origin).host;
  } catch {
    return undefined;
  }
}

const allowedOrigin = originHost(process.env.WEB_ORIGIN);
const nextConfig = {
  reactStrictMode: true,
  ...(allowedOrigin ? { allowedDevOrigins: [allowedOrigin] } : {}),
};
export default nextConfig;
