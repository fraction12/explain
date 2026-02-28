import fs from "node:fs";
import path from "node:path";
import { CliArgs, ExplainConfig } from "./types";

interface RawConfig {
  repoUrl?: string;
  include?: string[];
  exclude?: string[];
  output?: string;
  llm?: {
    baseUrl?: string;
    model?: string;
    apiKey?: string;
  };
  graph?: {
    maxNodes?: number;
  };
}

const DEFAULT_INCLUDE = ["**/*.{ts,tsx,js,jsx}"];
const DEFAULT_EXCLUDE = [
  "**/*.test.*",
  "**/*.spec.*",
  "node_modules/**",
  "**/node_modules/**",
  "dist/**",
  "**/dist/**",
  "build/**",
  "**/build/**",
  ".vercel/**",
  "**/.vercel/**",
  "out/**",
  "**/out/**",
  "coverage/**",
  "**/coverage/**",
  ".next/**",
  "**/.next/**",
  ".git/**",
  "**/.git/**",
];

function resolveEnvReference(value: string | undefined): string | undefined {
  if (!value) {
    return value;
  }
  const envRefMatch = value.match(/^\$([A-Z0-9_]+)$/);
  if (!envRefMatch) {
    return value;
  }
  return process.env[envRefMatch[1]];
}

function readConfig(configPath: string): RawConfig {
  if (!fs.existsSync(configPath)) {
    return {};
  }
  const raw = fs.readFileSync(configPath, "utf8");
  const parsed = JSON.parse(raw) as RawConfig;
  return parsed;
}

function readEnvFile(repoPath: string): Record<string, string> {
  const envPath = path.join(repoPath, ".env");
  if (!fs.existsSync(envPath)) {
    return {};
  }

  const data = fs.readFileSync(envPath, "utf8");
  const output: Record<string, string> = {};
  for (const line of data.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx <= 0) {
      continue;
    }
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, "");
    output[key] = value;
  }
  return output;
}

export function loadConfig(args: CliArgs): { config: ExplainConfig; configPath: string } {
  const configPath = args.configPath
    ? path.resolve(args.configPath)
    : path.resolve(args.repoPath, ".explainrc.json");
  const fileConfig = readConfig(configPath);
  const envFile = readEnvFile(args.repoPath);

  const baseUrl =
    args.baseUrl ?? process.env.EXPLAIN_BASE_URL ?? fileConfig.llm?.baseUrl ?? "https://api.openai.com/v1";
  const model = args.model ?? process.env.EXPLAIN_MODEL ?? fileConfig.llm?.model ?? "gpt-4o-mini";
  const apiKey =
    args.apiKey ??
    process.env.EXPLAIN_API_KEY ??
    resolveEnvReference(fileConfig.llm?.apiKey) ??
    envFile.EXPLAIN_API_KEY ??
    "";

  const output = args.output ?? fileConfig.output ?? "explain-output";

  const config: ExplainConfig = {
    repoUrl: fileConfig.repoUrl,
    include: fileConfig.include ?? DEFAULT_INCLUDE,
    exclude: fileConfig.exclude ?? DEFAULT_EXCLUDE,
    output,
    llm: {
      baseUrl,
      model,
      apiKey,
    },
    graph: {
      maxNodes: args.maxGraphNodes ?? fileConfig.graph?.maxNodes ?? 50,
    },
  };

  return { config, configPath };
}
