#!/usr/bin/env node
import path from "node:path";
import { parseArgs } from "./args";
import { getDefaultCachePath, readCache, createExplanationCacheKey, shouldExplainEntity, writeCache } from "./cache";
import { buildChangelog } from "./changelog";
import { loadConfig } from "./config";
import { buildDependencyEdges, buildGraph } from "./deps";
import { discoverFiles } from "./discovery";
import { getGitMetadata } from "./git";
import { createLlmClient, PROMPT_VERSION } from "./llm";
import { buildSourceUrl } from "./links";
import { parseFiles } from "./parser";
import { writeHtmlReport } from "./render/html";
import { writeJsonReport } from "./render/json";
import { Entity, ExplainError } from "./types";

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const { config } = loadConfig(args);

  const outputRoot = path.resolve(args.repoPath, config.output);
  const htmlDir = args.htmlDir ? path.resolve(args.htmlDir) : outputRoot;
  const jsonPath = args.jsonPath ? path.resolve(args.jsonPath) : path.join(outputRoot, "report.json");

  const errors: ExplainError[] = [];
  const git = await getGitMetadata(args.repoPath);

  if (args.verbose) {
    // eslint-disable-next-line no-console
    console.log(`[explain] repo=${args.repoPath} branch=${git.branch} commit=${git.commit}`);
  }

  const files = discoverFiles(args.repoPath, config.include, config.exclude).sort((a, b) => a.path.localeCompare(b.path));
  const fileHashes = Object.fromEntries(files.map((file) => [file.path, file.sha256]));

  const parsed = parseFiles(files, args.repoPath);
  const fileSummaries = parsed.map((entry) => ({
    path: entry.filePath,
    imports: entry.imports,
    exports: entry.exports,
    sourceUrl: buildSourceUrl(config.repoUrl, git.branch, entry.filePath),
  }));

  const entities: Entity[] = parsed
    .flatMap((entry) => entry.entities)
    .map((entity) => ({
      ...entity,
      explanation: {
        text: "",
        status: "ok",
      },
      sourceUrl: buildSourceUrl(config.repoUrl, git.branch, entity.filePath, entity.loc.startLine, entity.loc.endLine),
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
    repoUrl: config.repoUrl,
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
