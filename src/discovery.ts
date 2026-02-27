import fs from "node:fs";
import path from "node:path";
import { FileInfo } from "./types";
import { normalizeSlashes, sha256 } from "./utils";

function escapeRegex(text: string): string {
  return text.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}

function expandBraces(pattern: string): string[] {
  const match = pattern.match(/\{([^}]+)\}/);
  if (!match) {
    return [pattern];
  }
  const prefix = pattern.slice(0, match.index);
  const suffix = pattern.slice((match.index ?? 0) + match[0].length);
  return match[1].split(",").map((entry) => `${prefix}${entry}${suffix}`);
}

function globToRegex(pattern: string): RegExp {
  const normalized = normalizeSlashes(pattern);
  let result = "^";

  for (let i = 0; i < normalized.length; i += 1) {
    const ch = normalized[i];

    if (ch === "*") {
      const next = normalized[i + 1];
      if (next === "*") {
        const afterNext = normalized[i + 2];
        if (afterNext === "/") {
          result += "(?:.*/)?";
          i += 2;
        } else {
          result += ".*";
          i += 1;
        }
      } else {
        result += "[^/]*";
      }
      continue;
    }

    result += escapeRegex(ch);
  }

  result += "$";
  return new RegExp(result);
}

function compilePatterns(patterns: string[]): RegExp[] {
  return patterns.flatMap((pattern) => expandBraces(pattern).map(globToRegex));
}

function listFilesRecursive(root: string): string[] {
  const output: string[] = [];

  function walk(current: string): void {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(absolute);
      } else if (entry.isFile()) {
        output.push(absolute);
      }
    }
  }

  walk(root);
  return output;
}

export function discoverFiles(repoPath: string, include: string[], exclude: string[]): FileInfo[] {
  const includeRegexes = compilePatterns(include);
  const excludeRegexes = compilePatterns(exclude);

  return listFilesRecursive(repoPath)
    .map((absolutePath) => {
      const rel = normalizeSlashes(path.relative(repoPath, absolutePath));
      return { absolutePath, rel };
    })
    .filter((file) => includeRegexes.some((pattern) => pattern.test(file.rel)))
    .filter((file) => !excludeRegexes.some((pattern) => pattern.test(file.rel)))
    .map((file) => {
      const content = fs.readFileSync(file.absolutePath, "utf8");
      return {
        path: file.rel,
        absolutePath: file.absolutePath,
        content,
        sha256: sha256(content),
      } satisfies FileInfo;
    });
}
