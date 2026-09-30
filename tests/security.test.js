import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

const sensitiveName = /(^|\/)(\.env($|\.)|id_rsa($|\.)|id_ed25519($|\.)|credentials\.json$|secrets\.json$|.*\.(pem|key|p12|pfx)$)/i;
const secretPatterns = [
  /sk-[A-Za-z0-9_-]{20,}/,
  /gh[pousr]_[A-Za-z0-9]{20,}/,
  /github_pat_[A-Za-z0-9_]{20,}/,
  /AKIA[0-9A-Z]{16}/,
  /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/
];

function trackedFiles() {
  return execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" })
    .split(/\r?\n/)
    .filter(Boolean);
}

test("no sensitive credential filenames are tracked", () => {
  const bad = trackedFiles().filter((file) => sensitiveName.test(file));
  assert.deepEqual(bad, []);
});

test("tracked text files do not contain common secret token signatures", () => {
  const hits = [];
  for (const file of trackedFiles()) {
    const full = path.join(root, file);
    let text;
    try { text = fs.readFileSync(full, "utf8"); } catch { continue; }
    for (const pattern of secretPatterns) {
      if (pattern.test(text)) hits.push(file + " matched " + pattern);
    }
  }
  assert.deepEqual(hits, []);
});
