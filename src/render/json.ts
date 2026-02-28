import fs from "node:fs";
import path from "node:path";
import { ChangelogData, DependencyEdge, Entity, ExplainConfig, ExplainError, ReportJsonV1, RouteInfo } from "../types";

export function writeJsonReport(input: {
  path: string;
  repoPath: string;
  repoUrl: string;
  linkMode: "remote" | "local";
  branch: string;
  commit: string;
  config: ExplainConfig;
  entities: Entity[];
  files: Array<{ path: string; imports: string[]; exports: string[]; sourceUrl: string }>;
  edges: DependencyEdge[];
  routes: RouteInfo[];
  changelog: ChangelogData;
  graph: ReportJsonV1["graph"];
  errors: ExplainError[];
}): ReportJsonV1 {
  const llmFailedCount = input.entities.filter((e) => e.explanation.status === "failed").length;
  const llmCachedCount = input.entities.filter((e) => e.explanation.status === "cached").length;

  const report: ReportJsonV1 = {
    schemaVersion: "1.0",
    generatedAt: new Date().toISOString(),
    repo: {
      path: input.repoPath,
      repoUrl: input.repoUrl,
      linkMode: input.linkMode,
      branch: input.branch,
      commit: input.commit,
    },
    config: {
      include: input.config.include,
      exclude: input.config.exclude,
      output: input.config.output,
      model: input.config.llm.model,
      baseUrl: input.config.llm.baseUrl,
      maxGraphNodes: input.config.graph.maxNodes,
    },
    stats: {
      fileCount: input.files.length,
      entityCount: input.entities.length,
      routeCount: input.routes.length,
      llmFailedCount,
      llmCachedCount,
    },
    files: input.files.map((file) => ({
      path: file.path,
      entityIds: input.entities.filter((entity) => entity.filePath === file.path).map((entity) => entity.id),
      importCount: file.imports.length,
      exportCount: file.exports.length,
      sourceUrl: file.sourceUrl,
    })),
    entities: input.entities.map((entity) => ({
      id: entity.id,
      filePath: entity.filePath,
      name: entity.name,
      kind: entity.kind,
      exported: entity.exported,
      loc: entity.loc,
      signature: entity.signature,
      explanation: entity.explanation,
      sourceUrl: entity.sourceUrl,
    })),
    dependencies: {
      edges: input.edges,
    },
    routes: input.routes,
    changelog: input.changelog,
    graph: input.graph,
    errors: input.errors,
  };

  fs.mkdirSync(path.dirname(input.path), { recursive: true });
  fs.writeFileSync(input.path, JSON.stringify(report, null, 2), "utf8");
  return report;
}
