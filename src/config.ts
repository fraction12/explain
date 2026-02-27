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

export function loadConfig(args: CliArgs): { config: ExplainConfig; configPath: string } {
  const configPath = args.configPath
    ? path.resolve(args.configPath)
    : path.resolve(args.repoPath, ".explainrc.json");
  const fileConfig = readConfig(configPath);

  const baseUrl =
    args.baseUrl ?? process.env.EXPLAIN_BASE_URL ?? fileConfig.llm?.baseUrl ?? "https://api.openai.com/v1";
  const model = args.model ?? process.env.EXPLAIN_MODEL ?? fileConfig.llm?.model ?? "gpt-4o-mini";
  const apiKey =
    args.apiKey ?? process.env.EXPLAIN_API_KEY ?? resolveEnvReference(fileConfig.llm?.apiKey) ?? "";

  const output = args.output ?? fileConfig.output ?? "docs/explain";

  const config: ExplainConfig = {
    repoUrl: fileConfig.repoUrl ?? "",
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

  if (!config.repoUrl) {
    throw new Error("Missing required config field: repoUrl");
  }

  if (!config.llm.apiKey) {
    throw new Error("Missing LLM API key. Set EXPLAIN_API_KEY or llm.apiKey in config.");
  }

  return { config, configPath };
}
