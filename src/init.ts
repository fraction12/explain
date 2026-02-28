import fs from "node:fs";
import path from "node:path";
import { CliArgs } from "./types";

function upsertEnvKey(envPath: string, key: string, value: string): void {
  let content = "";
  if (fs.existsSync(envPath)) {
    content = fs.readFileSync(envPath, "utf8");
  }

  const lines = content ? content.split(/\r?\n/) : [];
  let replaced = false;
  const updated = lines.map((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith(`${key}=`)) {
      replaced = true;
      return `${key}=${value}`;
    }
    return line;
  });

  if (!replaced) {
    updated.push(`${key}=${value}`);
  }

  fs.writeFileSync(envPath, `${updated.filter(Boolean).join("\n")}\n`, "utf8");
}

function ensureGitignoreHasEnv(repoPath: string): void {
  const gitignorePath = path.join(repoPath, ".gitignore");
  const line = ".env";

  if (!fs.existsSync(gitignorePath)) {
    fs.writeFileSync(gitignorePath, `${line}\n`, "utf8");
    return;
  }

  const content = fs.readFileSync(gitignorePath, "utf8");
  const entries = content.split(/\r?\n/).map((v) => v.trim());
  if (!entries.includes(line)) {
    fs.appendFileSync(gitignorePath, `${content.endsWith("\n") ? "" : "\n"}${line}\n`, "utf8");
  }
}

export function runInit(args: CliArgs): void {
  const repoPath = args.repoPath;
  const configPath = args.configPath ? path.resolve(args.configPath) : path.join(repoPath, ".explainrc.json");

  const minimalConfig = {
    output: args.output ?? "explain-output",
    llm: {
      baseUrl: args.baseUrl ?? "https://api.openai.com/v1",
      model: args.model ?? "gpt-4o-mini",
      apiKey: "$EXPLAIN_API_KEY",
    },
    include: ["**/*.{ts,tsx,js,jsx}"],
    exclude: ["**/*.test.*", "**/*.spec.*", "node_modules/**", "dist/**", "build/**"],
  };

  fs.writeFileSync(configPath, `${JSON.stringify(minimalConfig, null, 2)}\n`, "utf8");

  if (args.apiKey) {
    const envPath = path.join(repoPath, ".env");
    upsertEnvKey(envPath, "EXPLAIN_API_KEY", args.apiKey);
    ensureGitignoreHasEnv(repoPath);
  }

  // eslint-disable-next-line no-console
  console.log(`[explain] initialized config at ${configPath}`);
  if (args.apiKey) {
    // eslint-disable-next-line no-console
    console.log(`[explain] saved EXPLAIN_API_KEY to ${path.join(repoPath, ".env")}`);
  }
  // eslint-disable-next-line no-console
  console.log(`[explain] next: explain ${repoPath}`);
}
