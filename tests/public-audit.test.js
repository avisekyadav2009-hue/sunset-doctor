import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizePublicGitHubRepoUrl } from "../src/public-audit.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const cli = path.join(root, "src", "index.js");

test("normalizes public GitHub repository URLs", () => {
  assert.deepEqual(
    normalizePublicGitHubRepoUrl("https://github.com/di-sukharev/opencommit.git"),
    {
      owner: "di-sukharev",
      repo: "opencommit",
      url: "https://github.com/di-sukharev/opencommit",
      cloneUrl: "https://github.com/di-sukharev/opencommit.git"
    }
  );
});

test("rejects non-GitHub and nested GitHub URLs", () => {
  assert.throws(
    () => normalizePublicGitHubRepoUrl("https://example.com/owner/repo"),
    /only supports/
  );
  assert.throws(
    () => normalizePublicGitHubRepoUrl("https://github.com/owner/repo/tree/main"),
    /root URLs/
  );
});

test("audit refuses --fix before cloning anything", () => {
  const result = spawnSync(
    process.execPath,
    [cli, "audit", "https://github.com/owner/repo", "--fix"],
    { cwd: root, encoding: "utf8" }
  );

  assert.equal(result.status, 2);
  assert.match(result.stderr, /does not modify third-party repositories/);
});
