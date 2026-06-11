import { execSync } from "node:child_process";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

execSync("pnpm exec changeset publish", { cwd: root, stdio: "inherit" });
