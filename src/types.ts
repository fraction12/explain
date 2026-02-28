export type EntityKind =
  | "function"
  | "class"
  | "method"
  | "component"
  | "interface"
  | "type"
  | "enum"
  | "const"
  | "route"
  | "module";

export interface ExplainConfig {
  repoUrl?: string;
  include: string[];
  exclude: string[];
  output: string;
  llm: {
    baseUrl: string;
    model: string;
    apiKey: string;
  };
  graph: {
    maxNodes: number;
  };
}

export interface CliArgs {
  command: "run" | "init";
  repoPath: string;
  configPath?: string;
  output?: string;
  jsonPath?: string;
  htmlDir?: string;
  force: boolean;
  maxGraphNodes?: number;
  baseUrl?: string;
  model?: string;
  apiKey?: string;
  noPrompt: boolean;
  verbose: boolean;
}

export interface FileInfo {
  path: string;
  absolutePath: string;
  sha256: string;
  content: string;
}

export interface Entity {
  id: string;
  filePath: string;
  name: string;
  kind: EntityKind;
  exported: boolean;
  loc: {
    startLine: number;
    endLine: number;
  };
  signature?: string;
  explanation: {
    text: string;
    status: "ok" | "failed" | "cached";
    errorMessage?: string;
  };
  sourceUrl: string;
  contentHash: string;
  snippet: string;
}

export interface RouteInfo {
  id: string;
  filePath: string;
  frameworkHint: "express" | "fastify" | "next" | "astro" | "unknown";
  method?: string;
  path?: string;
  loc: {
    startLine: number;
    endLine: number;
  };
  confidence: "high" | "medium" | "low";
}

export interface DependencyEdge {
  from: string;
  to: string;
}

export interface GraphData {
  nodes: string[];
  edges: DependencyEdge[];
  truncated: boolean;
  omittedNodeCount: number;
}

export interface DomainGroup {
  name: string;
  emoji: string;
  description: string;
  slug: string;
  files: string[];
}

export interface ChangelogData {
  addedEntities: string[];
  removedEntities: string[];
  changedEntities: string[];
  summaryText: string;
}

export interface ExplainError {
  scope: "config" | "parse" | "llm" | "render" | "cache";
  message: string;
  entityId?: string;
  filePath?: string;
}

export interface ReportJsonV1 {
  schemaVersion: "1.0";
  generatedAt: string;
  repo: {
    path: string;
    repoUrl: string;
    linkMode: "remote" | "local";
    branch: string;
    commit: string;
  };
  config: {
    include: string[];
    exclude: string[];
    output: string;
    model: string;
    baseUrl: string;
    maxGraphNodes: number;
  };
  stats: {
    fileCount: number;
    entityCount: number;
    routeCount: number;
    llmFailedCount: number;
    llmCachedCount: number;
  };
  files: Array<{
    path: string;
    entityIds: string[];
    importCount: number;
    exportCount: number;
    sourceUrl: string;
  }>;
  entities: Array<{
    id: string;
    filePath: string;
    name: string;
    kind: EntityKind;
    exported: boolean;
    loc: { startLine: number; endLine: number };
    signature?: string;
    explanation: { text: string; status: "ok" | "failed" | "cached"; errorMessage?: string };
    sourceUrl: string;
  }>;
  dependencies: {
    edges: DependencyEdge[];
  };
  routes: RouteInfo[];
  changelog: ChangelogData;
  graph: GraphData;
  projectSummary: string;
  domains: DomainGroup[];
  errors: ExplainError[];
}

export interface CacheSnapshot {
  snapshotHash: string;
  generatedAt: string;
  fileHashes: Record<string, string>;
  entityHashes: Record<string, string>;
  explanations: Record<
    string,
    {
      text: string;
      status: "ok" | "failed";
      errorMessage?: string;
    }
  >;
  projectSummaries?: Record<string, string>;
  domainClusters?: Record<string, DomainGroup[]>;
  lastSuccessfulSnapshot: {
    entityHashes: Record<string, string>;
    entityIds: string[];
  };
}
