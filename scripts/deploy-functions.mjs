/**
 * Deploy Cloud Functions with a longer discovery timeout (Windows-friendly).
 *
 * Usage:
 *   node scripts/deploy-functions.mjs
 *   node scripts/deploy-functions.mjs --only functions:deleteMyAccount
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const onlyFlagIndex = process.argv.indexOf("--only");
const onlyTarget =
  onlyFlagIndex >= 0 ? process.argv[onlyFlagIndex + 1] : "functions";

if (!onlyTarget) {
  console.error("Missing value for --only");
  process.exit(1);
}

const env = {
  ...process.env,
  FUNCTIONS_DISCOVERY_TIMEOUT: process.env.FUNCTIONS_DISCOVERY_TIMEOUT || "60",
};

console.log(
  `Deploying ${onlyTarget} (FUNCTIONS_DISCOVERY_TIMEOUT=${env.FUNCTIONS_DISCOVERY_TIMEOUT}s)`
);

const result = spawnSync(
  "firebase",
  ["deploy", "--only", onlyTarget],
  { cwd: root, env, stdio: "inherit", shell: true }
);

process.exit(result.status ?? 1);
