import fs from "node:fs";
import path from "node:path";
import { CacheSnapshot, Entity } from "./types";
import { sha256, timestamp } from "./utils";

const CACHE_DIR = ".explain";
const CACHE_FILE = "cache.json";

export function getDefaultCachePath(repoPath: string): string {
  return path.join(repoPath, CACHE_DIR, CACHE_FILE);
}

export function readCache(cachePath: string): CacheSnapshot | null {
  if (!fs.existsSync(cachePath)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(cachePath, "utf8");
    return JSON.parse(raw) as CacheSnapshot;
  } catch {
    return null;
  }
}

export function createExplanationCacheKey(entityHash: string, model: string, promptVersion: string): string {
  return `${entityHash}:${model}:${promptVersion}`;
}

export function shouldExplainEntity(
  entity: Entity,
  fileHashes: Record<string, string>,
  previousCache: CacheSnapshot | null,
  force: boolean,
): boolean {
  if (force || !previousCache) {
    return true;
  }

  const prevFileHash = previousCache.fileHashes[entity.filePath];
  const currentFileHash = fileHashes[entity.filePath];

  if (!prevFileHash || prevFileHash !== currentFileHash) {
    return true;
  }

  const prevEntityHash = previousCache.entityHashes[entity.id];
  return prevEntityHash !== entity.contentHash;
}

export function writeCache(
  cachePath: string,
  fileHashes: Record<string, string>,
  entities: Entity[],
  explanations: CacheSnapshot["explanations"],
  extras?: {
    projectSummaries?: Record<string, string>;
    domainClusters?: CacheSnapshot["domainClusters"];
  },
): CacheSnapshot {
  const entityHashes = Object.fromEntries(entities.map((entity) => [entity.id, entity.contentHash]));

  const snapshotHash = sha256(JSON.stringify({ fileHashes, entityHashes, explanations }));
  const snapshot: CacheSnapshot = {
    snapshotHash,
    generatedAt: timestamp(),
    fileHashes,
    entityHashes,
    explanations,
    projectSummaries: extras?.projectSummaries ?? {},
    domainClusters: extras?.domainClusters ?? {},
    lastSuccessfulSnapshot: {
      entityHashes,
      entityIds: entities.map((entity) => entity.id),
    },
  };

  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  fs.writeFileSync(cachePath, JSON.stringify(snapshot, null, 2), "utf8");
  return snapshot;
}
