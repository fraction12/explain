import simpleGit from "simple-git";

export async function getGitMetadata(repoPath: string): Promise<{ branch: string; commit: string }> {
  try {
    const git = simpleGit(repoPath);
    const [branchSummary, commit] = await Promise.all([git.branchLocal(), git.revparse(["HEAD"])]);
    return {
      branch: branchSummary.current || "main",
      commit: commit.trim(),
    };
  } catch {
    return {
      branch: "main",
      commit: "unknown",
    };
  }
}

function normalizeRemoteToHttps(remoteUrl: string): string | null {
  const cleaned = remoteUrl.trim().replace(/\.git$/, "");
  if (cleaned.startsWith("http://") || cleaned.startsWith("https://")) {
    return cleaned.replace(/^http:\/\//, "https://");
  }

  const sshMatch = cleaned.match(/^git@([^:]+):(.+)$/);
  if (sshMatch) {
    const [, host, repo] = sshMatch;
    return `https://${host}/${repo}`;
  }

  const sshUrlMatch = cleaned.match(/^ssh:\/\/git@([^/]+)\/(.+)$/);
  if (sshUrlMatch) {
    const [, host, repo] = sshUrlMatch;
    return `https://${host}/${repo}`;
  }

  return null;
}

export async function inferRepoUrl(repoPath: string): Promise<string | null> {
  try {
    const git = simpleGit(repoPath);
    const remoteUrl = await git.remote(["get-url", "origin"]);
    if (typeof remoteUrl !== "string") {
      return null;
    }
    return normalizeRemoteToHttps(remoteUrl) ?? null;
  } catch {
    return null;
  }
}
