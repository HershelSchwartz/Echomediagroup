import { execSync } from "node:child_process";

export default function globalSetup() {
  // Fresh seed data for every run.
  execSync("npm run db:reset", { stdio: "inherit" });
}
