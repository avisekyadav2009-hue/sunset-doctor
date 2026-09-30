import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

export function normalizePublicGitHubRepoUrl(input) {
  let url;
  try {
    url = new URL(input);
  } catch {
    throw new Error("audit expects a public GitHub repository URL");
  }

  if (url.protocol !== "https:" || url.hostname !== "github.com") {
    throw new Error("audit only supports https://github.com/<owner>/<repo>");
  }

  const parts = url.pathname
    .replace(/\.git$/, "")
    .split("/")
    .filter(Boolean);

  if (parts.length !== 2) {
    throw new Error("audit only supports repository root URLs");
  }

  const [owner, repo] = parts;
  const safe = /^[A-Za-z0-9_.-]+$/;
  if (!safe.test(owner) || !safe.test(repo)) {
    throw new Error("invalid GitHub owner or repository name");
  }

  return {
    owner,
    repo,
    url: `https://github.com/${owner}/${repo}`,
    cloneUrl: `https://github.com/${owner}/${repo}.git`
  };
}

export function clonePublicGitHubRepo(input) {
  const repo = normalizePublicGitHubRepoUrl(input);
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sunset-doctor-audit-"));
  const repoPath = path.join(tempRoot, repo.repo);

  const clone = spawnSync(
    "git",
    ["clone", "--depth", "1", "--quiet", "--", repo.cloneUrl, repoPath],
    {
      encoding: "utf8",
      timeout: 120000,
      windowsHide: true
    }
  );

  if (clone.error) {
    fs.rmSync(tempRoot, { recursive: true, force: true });
    throw new Error(`git clone failed: ${clone.error.message}`);
  }

  if (clone.status !== 0) {
    const message = (clone.stderr || clone.stdout || "git clone failed").trim();
    fs.rmSync(tempRoot, { recursive: true, force: true });
    throw new Error(message);
  }

  return {
    ...repo,
    tempRoot,
    repoPath,
    cleanup() {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  };
}
