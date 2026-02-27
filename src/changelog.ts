import { CacheSnapshot, ChangelogData } from "./types";

export function buildChangelog(currentEntityHashes: Record<string, string>, previousCache: CacheSnapshot | null): ChangelogData {
  const prev = previousCache?.lastSuccessfulSnapshot;
  if (!prev) {
    const ids = Object.keys(currentEntityHashes);
    return {
      addedEntities: ids,
      removedEntities: [],
      changedEntities: [],
      summaryText: `Initial snapshot: ${ids.length} entities analyzed.`,
    };
  }

  const prevHashes = prev.entityHashes;
  const currentIds = new Set(Object.keys(currentEntityHashes));
  const prevIds = new Set(Object.keys(prevHashes));

  const addedEntities = [...currentIds].filter((id) => !prevIds.has(id));
  const removedEntities = [...prevIds].filter((id) => !currentIds.has(id));
  const changedEntities = [...currentIds].filter((id) => prevHashes[id] && prevHashes[id] !== currentEntityHashes[id]);

  return {
    addedEntities,
    removedEntities,
    changedEntities,
    summaryText: `Changed since last successful run: +${addedEntities.length} / -${removedEntities.length} / ~${changedEntities.length}`,
  };
}
