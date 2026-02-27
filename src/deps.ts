import { DependencyEdge, GraphData } from "./types";

export interface FileRelations {
  filePath: string;
  imports: string[];
}

export function buildDependencyEdges(files: FileRelations[]): DependencyEdge[] {
  const edges: DependencyEdge[] = [];
  for (const file of files) {
    for (const imported of file.imports) {
      edges.push({ from: file.filePath, to: imported });
    }
  }
  return edges;
}

export function buildGraph(files: string[], edges: DependencyEdge[], maxNodes: number): GraphData {
  if (files.length <= maxNodes) {
    return {
      nodes: files,
      edges,
      truncated: false,
      omittedNodeCount: 0,
    };
  }

  const kept = new Set(files.slice(0, maxNodes));
  return {
    nodes: [...kept],
    edges: edges.filter((edge) => kept.has(edge.from) && kept.has(edge.to)),
    truncated: true,
    omittedNodeCount: files.length - kept.size,
  };
}
