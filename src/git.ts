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
