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
import { DomainGroup, Entity, ExplainError } from "./types";

interface LlmProgressState {
  total: number;
  done: number;
  ok: number;
  cached: number;
  failed: number;
}

function renderProgressBar(state: LlmProgressState): string {
  const width = 28;
  const safeTotal = Math.max(state.total, 1);
  const ratio = Math.min(state.done / safeTotal, 1);
  const filled = Math.round(width * ratio);
  const empty = width - filled;
  const pct = Math.round(ratio * 100)
    .toString()
    .padStart(3, " ");

  return `[${"#".repeat(filled)}${"-".repeat(empty)}] ${pct}% ${state.done}/${state.total} ok:${state.ok} cached:${state.cached} failed:${state.failed}`;
}

function updateProgress(state: LlmProgressState, forceNewLine = false): void {
  const line = renderProgressBar(state);
  if (!output.isTTY) {
    // Non-interactive output should stay readable in CI logs.
    if (forceNewLine || state.done === state.total || state.done % 10 === 0) {
      // eslint-disable-next-line no-console
      console.log(`[llm] ${line}`);
    }
    return;
  }

  output.write(`\r${line}`);
  if (forceNewLine || state.done === state.total) {
    output.write("\n");
  }
}

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
  // eslint-disable-next-line no-console
  console.log(`[explain] generating LLM explanations for ${entities.length} entities...`);
  const progress: LlmProgressState = {
    total: entities.length,
    done: 0,
    ok: 0,
    cached: 0,
    failed: 0,
  };
  updateProgress(progress, true);

  for (const entity of entities) {
    const shouldExplain = shouldExplainEntity(entity, fileHashes, previousCache, args.force);
    const key = createExplanationCacheKey(entity.contentHash, config.llm.model, PROMPT_VERSION);

    if (!shouldExplain && explanationCache[key]) {
      entity.explanation = {
        text: explanationCache[key].text,
        status: "cached",
        errorMessage: explanationCache[key].errorMessage,
      };
      progress.done += 1;
      progress.cached += 1;
      updateProgress(progress);
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
      progress.done += 1;
      progress.ok += 1;
      updateProgress(progress);
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
      progress.done += 1;
      progress.failed += 1;
      updateProgress(progress);
    }
  }
  updateProgress(progress, true);

  const summaryContext = parsed.map((entry) => ({
    filePath: entry.filePath,
    entityNames: entry.entities.map((e) => e.name),
    importCount: entry.imports.length,
    exportCount: entry.exports.length,
  }));

  const domainContext = parsed.map((entry) => ({
    filePath: entry.filePath,
    entityNames: entry.entities.map((e) => e.name),
    entityKinds: entry.entities.map((e) => e.kind),
  }));

  const summaryHashKey = createExplanationCacheKey(
    JSON.stringify(summaryContext.map((c) => c.filePath).sort()),
    config.llm.model,
    `${PROMPT_VERSION}-summary`,
  );
  let projectSummary = previousCache?.projectSummaries?.[summaryHashKey] ?? "";
  if (!projectSummary || args.force) {
    projectSummary = await llm.generateProjectSummary(summaryContext);
  }

  const domainHashKey = createExplanationCacheKey(
    JSON.stringify(domainContext.map((c) => c.filePath).sort()),
    config.llm.model,
    `${PROMPT_VERSION}-domains`,
  );
  let domains: DomainGroup[] = previousCache?.domainClusters?.[domainHashKey] ?? [];
  if (domains.length === 0 || args.force) {
    domains = await llm.clusterDomains(domainContext);
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
    projectSummary,
    domains,
  });

  writeHtmlReport({
    outDir: htmlDir,
    entities,
    files: fileSummaries,
    routes,
    changelog,
    projectSummary,
    domains,
  });

  writeCache(cachePath, fileHashes, entities, explanationCache, {
    projectSummaries: {
      ...(previousCache?.projectSummaries ?? {}),
      [summaryHashKey]: projectSummary,
    },
    domainClusters: {
      ...(previousCache?.domainClusters ?? {}),
      [domainHashKey]: domains,
    },
  });

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
