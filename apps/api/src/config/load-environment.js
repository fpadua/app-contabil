import { config } from "dotenv";
import { fileURLToPath } from "node:url";

const rootEnvironmentFile = fileURLToPath(new URL("../../../../.env", import.meta.url));

config({
  path: process.env.DOTENV_CONFIG_PATH ?? rootEnvironmentFile,
  quiet: true,
});
