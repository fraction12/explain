#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { parseArgs } from "./args";
import { getDefaultCachePath, readCache, createExplanationCacheKey, shouldExplainEntity, writeCache } from "./cache";
import { buildChangelog } from "./changelog";
import { loadConfig } from "./config";
import { buildDependencyEdges, buildGraph } from "./deps";
import { discoverFiles } from "./discovery";
import { getGitMetadata, inferRepoUrl } from "./git";
import { runInit } from "./init";
import { createLlmClient, PROMPT_VERSION } from "./llm";
import { buildSourceUrl } from "./links";
import { parseFiles } from "./parser";
import { writeHtmlReport } from "./render/html";
import { writeJsonReport } from "./render/json";
import { Entity, ExplainError } from "./types";

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

async function promptForApiKey(repoPath: string): Promise<string> {
  const rl = readline.createInterface({ input, output });
  try {
    const key = (await rl.question("Enter EXPLAIN_API_KEY: ")).trim();
    if (!key) {
      throw new Error("No API key entered");
    }

    const persist = (await rl.question("Save key to <repo>/.env? (y/N): ")).trim().toLowerCase();
    if (persist === "y" || persist === "yes") {
      const envPath = path.join(repoPath, ".env");
      upsertEnvKey(envPath, "EXPLAIN_API_KEY", key);
      ensureGitignoreHasEnv(repoPath);
    }

    return key;
  } finally {
    rl.close();
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.command === "init") {
    runInit(args);
    return;
  }

  const { config } = loadConfig(args);

  if (!config.llm.apiKey) {
    if (args.noPrompt || !input.isTTY) {
      throw new Error("Missing LLM API key. Use --api-key, EXPLAIN_API_KEY, or run interactively.");
    }
    config.llm.apiKey = await promptForApiKey(args.repoPath);
  }

  const inferredRepoUrl = await inferRepoUrl(args.repoPath);
  const repoUrl = config.repoUrl ?? inferredRepoUrl ?? "";
  const linkMode: "remote" | "local" = repoUrl ? "remote" : "local";

  const outputRoot = path.resolve(args.repoPath, config.output);
  const htmlDir = args.htmlDir ? path.resolve(args.htmlDir) : outputRoot;
  const jsonPath = args.jsonPath ? path.resolve(args.jsonPath) : path.join(outputRoot, "report.json");

  const errors: ExplainError[] = [];
  const git = await getGitMetadata(args.repoPath);

  if (args.verbose) {
    // eslint-disable-next-line no-console
    console.log(`[explain] repo=${args.repoPath} branch=${git.branch} commit=${git.commit} linkMode=${linkMode}`);
  }

  const files = discoverFiles(args.repoPath, config.include, config.exclude).sort((a, b) => a.path.localeCompare(b.path));
  const fileHashes = Object.fromEntries(files.map((file) => [file.path, file.sha256]));

  const parsed = parseFiles(files, args.repoPath);
  const fileSummaries = parsed.map((entry) => ({
    path: entry.filePath,
    imports: entry.imports,
    exports: entry.exports,
    sourceUrl: buildSourceUrl(repoUrl || undefined, git.branch, entry.filePath),
  }));

  const entities: Entity[] = parsed
    .flatMap((entry) => entry.entities)
    .map((entity) => ({
      ...entity,
      explanation: {
        text: "",
        status: "ok",
      },
      sourceUrl: buildSourceUrl(repoUrl || undefined, git.branch, entity.filePath, entity.loc.startLine, entity.loc.endLine),
    }));

  const routes = parsed.flatMap((entry) => entry.routes);

  const cachePath = getDefaultCachePath(args.repoPath);
  const previousCache = readCache(cachePath);
  const explanationCache = { ...(previousCache?.explanations ?? {}) };

  const llm = createLlmClient(config.llm, args.verbose);

  for (const entity of entities) {
    const shouldExplain = shouldExplainEntity(entity, fileHashes, previousCache, args.force);
    const key = createExplanationCacheKey(entity.contentHash, config.llm.model, PROMPT_VERSION);

    if (!shouldExplain && explanationCache[key]) {
      entity.explanation = {
        text: explanationCache[key].text,
        status: "cached",
        errorMessage: explanationCache[key].errorMessage,
      };
      continue;
    }

    try {
      const text = await llm.explainEntity({
        filePath: entity.filePath,
        kind: entity.kind,
        name: entity.name,
        signature: entity.signature,
        exported: entity.exported,
        snippet: entity.snippet,
      });
      entity.explanation = { text, status: "ok" };
      explanationCache[key] = { text, status: "ok" };
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown LLM error";
      entity.explanation = {
        text: "Explanation unavailable due to provider error.",
        status: "failed",
        errorMessage: message,
      };
      explanationCache[key] = {
        text: entity.explanation.text,
        status: "failed",
        errorMessage: message,
      };
      errors.push({
        scope: "llm",
        message,
        entityId: entity.id,
        filePath: entity.filePath,
      });
    }
  }

  const entityHashes = Object.fromEntries(entities.map((entity) => [entity.id, entity.contentHash]));
  const changelog = buildChangelog(entityHashes, previousCache);

  const edges = buildDependencyEdges(fileSummaries.map((file) => ({ filePath: file.path, imports: file.imports })));
  const graph = buildGraph(fileSummaries.map((f) => f.path), edges, config.graph.maxNodes);

  writeJsonReport({
    path: jsonPath,
    repoPath: args.repoPath,
    repoUrl,
    linkMode,
    branch: git.branch,
    commit: git.commit,
    config,
    entities,
    files: fileSummaries,
    edges,
    routes,
    changelog,
    graph,
    errors,
  });

  writeHtmlReport({
    outDir: htmlDir,
    entities,
    files: fileSummaries,
    routes,
    changelog,
    graph,
  });

  writeCache(cachePath, fileHashes, entities, explanationCache);

  // eslint-disable-next-line no-console
  console.log(
    `[explain] done files=${files.length} entities=${entities.length} routes=${routes.length} failures=${errors.length} html=${htmlDir} json=${jsonPath}`,
  );
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("[explain] fatal:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
