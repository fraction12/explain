import { ensureTrailingSlash } from "./utils";

export function buildSourceUrl(repoUrl: string, branch: string, filePath: string, startLine?: number, endLine?: number): string {
  const base = ensureTrailingSlash(repoUrl.replace(/\.git$/, ""));
  if (!startLine) {
    return `${base}blob/${branch}/${filePath}`;
  }
  if (!endLine || endLine === startLine) {
    return `${base}blob/${branch}/${filePath}#L${startLine}`;
  }
  return `${base}blob/${branch}/${filePath}#L${startLine}-L${endLine}`;
}
