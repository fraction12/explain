import { ensureTrailingSlash } from "./utils";

export function buildSourceUrl(
  repoUrl: string | undefined,
  branch: string,
  filePath: string,
  startLine?: number,
  endLine?: number,
): string {
  if (!repoUrl) {
    if (!startLine) {
      return filePath;
    }
    if (!endLine || endLine === startLine) {
      return `${filePath}:L${startLine}`;
    }
    return `${filePath}:L${startLine}-L${endLine}`;
  }

  const base = ensureTrailingSlash(repoUrl.replace(/\.git$/, ""));
  if (!startLine) {
    return `${base}blob/${branch}/${filePath}`;
  }
  if (!endLine || endLine === startLine) {
    return `${base}blob/${branch}/${filePath}#L${startLine}`;
  }
  return `${base}blob/${branch}/${filePath}#L${startLine}-L${endLine}`;
}
