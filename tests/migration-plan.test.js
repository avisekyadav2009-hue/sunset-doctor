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

function run(args, env = {}) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, ...env }
  });
}

function tempProject(source) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sunset-plan-"));
  fs.writeFileSync(path.join(dir, "app.js"), source, "utf8");
  return dir;
}

test("migration plan detects prompt, Evals, and Agent Builder surfaces", () => {
  const dir = tempProject([
    'const prompt = { id: "pmpt_support_v1" };',
    'client.evals.runs.create("eval_123", {});',
    'const workflow = { id: "wf_68df4b13b3588190" };'
  ].join("\n"));
  const planPath = path.join(dir, "migration-plan.md");
  const result = run([
    "scan", dir, "--json", "--plan", planPath, "--fail-on", "never"
  ]);

  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  const ids = report.surface_findings.map((f) => f.id).sort();

  assert.deepEqual(ids, [
    "agent-builder-workflow-id",
    "evals-sdk-usage",
    "reusable-prompt-id"
  ]);
  assert.equal(report.migration_plan.total_items, 3);
  assert.equal(report.migration_plan.safe_autofix_items, 0);
  assert.equal(fs.existsSync(planPath), true);

  const plan = fs.readFileSync(planPath, "utf8");
  assert.match(plan, /Reusable prompt object/);
  assert.match(plan, /OpenAI Evals SDK usage/);
  assert.match(plan, /Agent Builder hosted workflow/);
  assert.match(plan, /Official guidance/);
});

test("architectural migration signals remain manual during --fix", () => {
  const dir = tempProject(
    'const prompt = { id: "pmpt_support_v1" };\n' +
    'const workflow = { id: "wf_123456789" };\n'
  );
  const file = path.join(dir, "app.js");
  const before = fs.readFileSync(file, "utf8");
  const result = run(["scan", dir, "--json", "--fix", "--fail-on", "never"]);

  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.fixes.length, 0);
  assert.equal(report.surface_findings.length, 2);
  assert.equal(fs.readFileSync(file, "utf8"), before);
  assert.equal(report.migration_plan.manual_items, 2);
});

test("migration surfaces participate in CI failure thresholds", () => {
  const dir = tempProject('fetch("https://api.openai.com/v1/evals");\n');
  const fail = run(["scan", dir, "--fail-on", "critical"]);
  const pass = run(["scan", dir, "--fail-on", "never"]);

  assert.equal(fail.status, 1);
  assert.equal(pass.status, 0);
});

test("GitHub Action can write migration plan from INPUT_PLAN", () => {
  const dir = tempProject('const workflow = { id: "wf_123456789" };\n');
  const planPath = path.join(dir, "gha-plan.md");
  const result = run([], {
    GITHUB_ACTIONS: "true",
    INPUT_PATH: dir,
    "INPUT_FAIL-ON": "never",
    INPUT_REPORT: "",
    INPUT_PLAN: planPath
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.existsSync(planPath), true);
  assert.match(fs.readFileSync(planPath, "utf8"), /Agent Builder hosted workflow/);
});
