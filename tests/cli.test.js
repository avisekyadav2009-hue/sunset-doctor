import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const cli = path.join(root, "src", "index.js");

function run(args) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: root,
    encoding: "utf8"
  });
}

function tempProject(source) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sunset-doctor-"));
  fs.writeFileSync(path.join(dir, "app.js"), source, "utf8");
  return dir;
}

test("JSON scan finds fixture deprecations", () => {
  const result = run(["scan", "./fixtures", "--json", "--fail-on", "never"]);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.files_scanned, 1);
  assert.equal(report.summary.total, 2);
  assert.equal(report.summary.critical, 1);
  assert.equal(report.summary.high, 1);
});

test("dry-run previews a safe model replacement without editing", () => {
  const dir = tempProject('const model = "gpt-5-2025-08-07";\n');
  const file = path.join(dir, "app.js");
  const before = fs.readFileSync(file, "utf8");
  const result = run(["scan", dir, "--json", "--dry-run", "--fail-on", "never"]);

  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.mode, "dry-run");
  assert.equal(report.fixes.length, 1);
  assert.equal(report.fixes[0].applied, false);
  assert.equal(fs.readFileSync(file, "utf8"), before);
});

test("--fix replaces safe model IDs and leaves manual migrations", () => {
  const dir = tempProject(
    'const model = "gpt-5-2025-08-07";\nconst endpoint = "/v1/prompts";\n'
  );
  const file = path.join(dir, "app.js");
  const result = run(["scan", dir, "--json", "--fix", "--fail-on", "never"]);

  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  const updated = fs.readFileSync(file, "utf8");

  assert.match(updated, /gpt-5\.6-sol/);
  assert.doesNotMatch(updated, /gpt-5-2025-08-07/);
  assert.match(updated, /\/v1\/prompts/);
  assert.equal(report.fixes.length, 1);
  assert.equal(report.fixes[0].applied, true);
  assert.equal(report.summary.total, 1);
  assert.equal(report.findings[0].id, "/v1/prompts");
});

test("HTML report is generated", () => {
  const dir = tempProject('const model = "gpt-5-2025-08-07";\n');
  const reportPath = path.join(dir, "report.html");
  const result = run([
    "scan", dir, "--html", reportPath, "--fail-on", "never"
  ]);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.existsSync(reportPath), true);
  const html = fs.readFileSync(reportPath, "utf8");
  assert.match(html, /SunsetDoctor/);
  assert.match(html, /gpt-5-2025-08-07/);
});

test("failure threshold returns non-zero for matching severity", () => {
  const dir = tempProject('const model = "gpt-5-2025-08-07";\n');
  const fail = run(["scan", dir, "--fail-on", "high"]);
  const pass = run(["scan", dir, "--fail-on", "critical"]);

  assert.equal(fail.status, 1);
  assert.equal(pass.status, 0);
});

test("overlapping model names report only the specific match", () => {
  const dir = tempProject('const model = "gpt-realtime-mini";\n');
  const result = run(["scan", dir, "--json", "--fail-on", "never"]);

  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.summary.total, 1);
  assert.equal(report.findings[0].id, "gpt-realtime-mini");
});

test("deprecated aliases do not match newer model prefixes", () => {
  const dir = tempProject('const model = "gpt-4.1";\n');
  const result = run(["scan", dir, "--json", "--fail-on", "never"]);

  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.summary.total, 0);
});
