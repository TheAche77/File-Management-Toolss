import { spawnSync } from "node:child_process";

const args = process.argv.slice(2).filter((arg) => arg !== "--");

const result = spawnSync(
  "pnpm",
  ["--filter", "@workspace/api-server", "run", "mock:enrich-all", "--", ...args],
  {
    stdio: "inherit",
    env: process.env,
  },
);

process.exitCode = result.status ?? 1;
