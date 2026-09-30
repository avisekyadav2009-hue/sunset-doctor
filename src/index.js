#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  buildMigrationPlan,
  renderMigrationPlanMarkdown,
  scanMigrationSurfaces
} from "./migration-plan.js";
import { clonePublicGitHubRepo } from "./public-audit.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const registry = JSON.parse(
  fs.readFileSync(path.join(here, "..", "registry.json"), "utf8")
);

const IGNORE_DIRS = new Set([
  ".git", "node_modules", "dist", "build", ".next", ".venv", "venv", "vendor"
]);
const EXTENSIONS = new Set([
  ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".py", ".json", ".yaml", ".yml",
  ".env", ".toml", ".md", ".txt", ".php", ".rb", ".go", ".java", ".cs"
]);
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const SEVERITY_RANK = { critical: 3, high: 2, medium: 1, low: 0 };

function walk(root, out = []) {
  let stat;
  try { stat = fs.statSync(root); } catch { return out; }
  if (stat.isDirectory()) {
    if (IGNORE_DIRS.has(path.basename(root))) return out;
    for (const name of fs.readdirSync(root)) {
      walk(path.join(root, name), out);
    }
    return out;
  }

  if (!stat.isFile() || stat.size > MAX_FILE_BYTES) return out;
  const ext = path.extname(root).toLowerCase();
  const base = path.basename(root);
  if (EXTENSIONS.has(ext) || base === ".env") out.push(root);
  return out;
}

function findLineMatches(line) {
  const lower = line.toLowerCase();
  const candidates = [];

  for (const item of registry) {
    const needle = item.id.toLowerCase();
    const tokenChar = /[A-Za-z0-9._-]/;
    let start = 0;
    while ((start = lower.indexOf(needle, start)) !== -1) {
      const end = start + needle.length;
      const before = start > 0 ? lower[start - 1] : "";
      const after = end < lower.length ? lower[end] : "";
      const leftOk = !tokenChar.test(needle[0]) || !tokenChar.test(before);
      const rightOk =
        !tokenChar.test(needle[needle.length - 1]) || !tokenChar.test(after);

      if (leftOk && rightOk) candidates.push({ item, start, end });
      start += Math.max(needle.length, 1);
    }
  }

  candidates.sort((a, b) =>
    a.start - b.start || (b.end - b.start) - (a.end - a.start)
  );

  const selected = [];
  for (const candidate of candidates) {
    const contained = selected.some(
      (match) => candidate.start >= match.start && candidate.end <= match.end
    );
    if (!contained) selected.push(candidate);
  }
  return selected;
}

function scanFile(file) {
  let text;
  try { text = fs.readFileSync(file, "utf8"); } catch { return []; }
  const lines = text.split(/\r?\n/);
  const findings = [];

  lines.forEach((line, idx) => {
    const seen = new Set();
    for (const { item } of findLineMatches(line)) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      findings.push({
        ...item,
        file,
        line: idx + 1,
        excerpt: line.trim().slice(0, 240)
      });
    }
  });
  return findings;
}

function scanFiles(files) {
  return files
    .flatMap(scanFile)
    .map((f) => ({ ...f, days_remaining: daysUntil(f.sunset) }))
    .sort((a, b) =>
      a.sunset.localeCompare(b.sunset) ||
      a.file.localeCompare(b.file) ||
      a.line - b.line
    );
}

function daysUntil(dateStr) {
  const now = new Date();
  const end = new Date(dateStr + "T23:59:59Z");
  return Math.ceil((end - now) / 86400000);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const hasCommand = args[0] && !args[0].startsWith("--");
  const command = hasCommand ? args[0] : "scan";
  if (!["scan", "audit"].includes(command)) {
    console.error(
      "Usage: sunset-doctor <scan|audit> <path|github-url> [--json] [--html FILE] [--plan FILE] [--fail-on LEVEL] [--fix] [--dry-run] [--diff]"
    );
    process.exit(2);
  }

  let targetArg = command === "audit" ? null : ".";
  let json = false;
  let htmlPath = null;
  let planPath = null;
  let failOn = "critical";
  let fix = false;
  let dryRun = false;
  let diff = false;
  const start = hasCommand ? 1 : 0;

  for (let i = start; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--json") json = true;
    else if (arg === "--html") htmlPath = args[++i];
    else if (arg === "--plan") planPath = args[++i];
    else if (arg === "--fail-on") failOn = (args[++i] || "").toLowerCase();
    else if (arg === "--fix") fix = true;
    else if (arg === "--dry-run") dryRun = true;
    else if (arg === "--diff") diff = true;
    else if (!arg.startsWith("--") && (targetArg === "." || targetArg === null)) targetArg = arg;
  }
  if (dryRun || diff) fix = true;
  if (diff) dryRun = true;

  if (command === "audit" && !targetArg) {
    console.error("audit requires a public GitHub repository URL.");
    process.exit(2);
  }

  if (process.env.GITHUB_ACTIONS === "true") {
    targetArg = process.env.INPUT_PATH || targetArg;
    failOn = (
      process.env["INPUT_FAIL-ON"] ||
      process.env.INPUT_FAIL_ON ||
      failOn
    ).toLowerCase();
    htmlPath = process.env.INPUT_REPORT || htmlPath;
    planPath = process.env.INPUT_PLAN || planPath;
  }

  const validFail = new Set([
    "critical", "high", "medium", "low", "any", "overdue", "never"
  ]);
  if (!validFail.has(failOn)) {
    console.error(
      "Invalid --fail-on value. Use critical, high, medium, low, any, overdue, or never."
    );
    process.exit(2);
  }
  if (htmlPath === undefined) {
    console.error("--html requires a file path.");
    process.exit(2);
  }
  if (planPath === undefined) {
    console.error("--plan requires a file path.");
    process.exit(2);
  }

  return {
    command,
    target: command === "audit" ? targetArg : path.resolve(targetArg),
    json,
    htmlPath: htmlPath ? path.resolve(htmlPath) : null,
    planPath: planPath ? path.resolve(planPath) : null,
    failOn,
    fix,
    dryRun,
    diff
  };
}
function isSafeModelReplacement(finding) {
  return (
    finding.kind === "model" &&
    /^[A-Za-z0-9._-]+$/.test(finding.replacement)
  );
}

function applySafeFixes(findings, dryRun) {
  const byFile = new Map();

  for (const finding of findings) {
    if (!isSafeModelReplacement(finding)) continue;
    if (!byFile.has(finding.file)) byFile.set(finding.file, new Map());
    byFile.get(finding.file).set(finding.id, finding.replacement);
  }

  const fixes = [];
  for (const [file, replacements] of byFile.entries()) {
    let text;
    try { text = fs.readFileSync(file, "utf8"); } catch { continue; }
    let updated = text;

    for (const [from, to] of replacements.entries()) {
      const count = updated.split(from).length - 1;
      if (!count) continue;
      updated = updated.split(from).join(to);
      fixes.push({ file, from, to, count, applied: !dryRun });
    }

    if (!dryRun && updated !== text) {
      fs.writeFileSync(file, updated, "utf8");
    }
  }
  return fixes;
}
function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function summarize(findings) {
  const summary = {
    total: findings.length,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    overdue: 0
  };
  for (const f of findings) {
    if (summary[f.severity] !== undefined) summary[f.severity]++;
    if (f.days_remaining < 0) summary.overdue++;
  }
  return summary;
}

function renderHtml(result) {
  const relativeRoot = result.scan_root || result.target;
  const displayTarget = result.source_url || result.target;
  const rows = result.findings.map((f) => {
    const rel = path.relative(relativeRoot, f.file) || path.basename(f.file);
    const countdown = f.days_remaining >= 0
      ? f.days_remaining + " days left"
      : Math.abs(f.days_remaining) + " days overdue";
    return `<tr>
<td><strong>${escapeHtml(f.severity.toUpperCase())}</strong></td>
<td><code>${escapeHtml(f.id)}</code><br><small>${escapeHtml(f.kind)}</small></td>
<td><code>${escapeHtml(rel)}:${f.line}</code></td>
<td>${escapeHtml(f.sunset)}<br><small>${escapeHtml(countdown)}</small></td>
<td>${escapeHtml(f.replacement)}</td>
</tr>`;
  }).join("\n");

  const fixRows = result.fixes.map((f) => {
    const rel = path.relative(relativeRoot, f.file) || path.basename(f.file);
    const mode = f.applied ? "applied" : "preview";
    return `<tr>
<td><code>${escapeHtml(rel)}</code></td>
<td><code>${escapeHtml(f.from)}</code></td>
<td><code>${escapeHtml(f.to)}</code></td>
<td>${f.count}</td><td>${mode}</td>
</tr>`;
  }).join("\n");

  const s = result.summary;
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>SunsetDoctor Report</title>
<style>
body{font-family:system-ui,-apple-system,Segoe UI,sans-serif;margin:40px;max-width:1200px;color:#171717}
h1{margin-bottom:4px}.muted{color:#666}.cards{display:flex;gap:12px;flex-wrap:wrap;margin:24px 0}
.card{border:1px solid #ddd;border-radius:10px;padding:12px 16px;min-width:110px}.n{font-size:28px;font-weight:700}
table{width:100%;border-collapse:collapse;margin-top:20px}th,td{text-align:left;vertical-align:top;padding:10px;border-bottom:1px solid #e5e5e5}
th{background:#f7f7f7}code{font-size:12px}small{color:#666}</style></head>
<body><h1>SunsetDoctor</h1>
<p class="muted">OpenAI deprecation scan for <code>${escapeHtml(displayTarget)}</code></p>
<div class="cards">
<div class="card"><div class="n">${s.total}</div><div>Remaining findings</div></div>
<div class="card"><div class="n">${s.critical}</div><div>Critical</div></div>
<div class="card"><div class="n">${s.high}</div><div>High</div></div>
<div class="card"><div class="n">${result.fixes.length}</div><div>Safe fixes</div></div>
</div>
<h2>Findings</h2>
<table><thead><tr><th>Severity</th><th>Reference</th><th>Location</th><th>Shutdown</th><th>Migration</th></tr></thead>
<tbody>${rows || '<tr><td colspan="5">No known deprecation references found.</td></tr>'}</tbody></table>
<h2>Safe model-ID fixes</h2>
<table><thead><tr><th>File</th><th>From</th><th>To</th><th>Count</th><th>Status</th></tr></thead>
<tbody>${fixRows || '<tr><td colspan="5">No safe automatic fixes identified.</td></tr>'}</tbody></table>
<p class="muted">Generated ${escapeHtml(result.generated_at)} Â· Registry entries: ${registry.length}</p>
</body></html>`;
}

function shouldFail(findings, failOn) {
  if (failOn === "never") return false;
  if (failOn === "any") return findings.length > 0;
  if (failOn === "overdue") return findings.some((f) => f.days_remaining < 0);
  const threshold = SEVERITY_RANK[failOn];
  return findings.some((f) => (SEVERITY_RANK[f.severity] ?? 0) >= threshold);
}

function setActionOutput(name, value) {
  if (!process.env.GITHUB_OUTPUT) return;
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
}

function printFixes(fixes, target, dryRun) {
  if (!fixes.length) return;
  console.log(dryRun ? "Safe fixes available:" : "Safe fixes applied:");
  for (const f of fixes) {
    const rel = path.relative(target, f.file) || path.basename(f.file);
    console.log(`  ${rel}: ${f.from} -> ${f.to} (${f.count} occurrence(s))`);
  }
  console.log("");
}

function printMigrationDiff(fixes, target) {
  if (!fixes.length) {
    console.log("Migration diff: no safe automatic replacements available.\n");
    return;
  }

  console.log("Migration diff:");
  for (const f of fixes) {
    const rel = path.relative(target, f.file) || path.basename(f.file);
    console.log(`  ${rel}`);
    console.log(`    BEFORE: ${f.from}`);
    console.log(`    AFTER:  ${f.to}`);
    console.log(`    CHANGES: ${f.count}`);
  }
  console.log("");
}

function actionEscape(value) {
  return String(value)
    .replaceAll("%", "%25")
    .replaceAll("\r", "%0D")
    .replaceAll("\n", "%0A")
    .replaceAll(":", "%3A")
    .replaceAll(",", "%2C");
}

function emitActionAnnotations(findings) {
  if (process.env.GITHUB_ACTIONS !== "true") return;

  for (const f of findings) {
    const level = f.severity === "critical" ? "error" :
      f.severity === "high" ? "warning" : "notice";
    const file = path.relative(process.cwd(), f.file) || path.basename(f.file);
    const title = `SunsetDoctor: ${f.id}`;
    const message = `${f.kind} ${f.id} sunsets ${f.sunset}. Migrate to: ${f.replacement}`;
    console.error(
      `::${level} file=${actionEscape(file)},line=${f.line},title=${actionEscape(title)}::${actionEscape(message)}`
    );
  }
}

function printFindings(findings, target) {
  if (!findings.length) {
    console.log("No known deprecation references found.");
    return;
  }

  console.log("");
  for (const f of findings) {
    const rel = path.relative(target, f.file) || path.basename(f.file);
    const remain = f.days_remaining >= 0
      ? `${f.days_remaining} days left`
      : `${Math.abs(f.days_remaining)} days overdue`;
    console.log(`[${f.severity.toUpperCase()}] ${f.kind}: ${f.id}`);
    console.log(`  ${rel}:${f.line}`);
    console.log(`  Sunset: ${f.sunset} (${remain})`);
    console.log(`  Replace/migrate: ${f.replacement}`);
    console.log(`  > ${f.excerpt}`);
    console.log("");
  }
}

function main() {
  let audit = null;
  let exitCode = 0;

  try {
    const options = parseArgs();

    if (options.command === "audit" && options.fix && !options.dryRun) {
      throw new Error("audit does not modify third-party repositories; use --dry-run or --diff instead of --fix");
    }

    let scanTarget = options.target;
    let displayTarget = options.target;

    if (options.command === "audit") {
      audit = clonePublicGitHubRepo(options.target);
      scanTarget = audit.repoPath;
      displayTarget = audit.url;
    }

    const files = walk(scanTarget);
    const before = scanFiles(files);
    const surfaceBefore = scanMigrationSurfaces(files)
      .map((f) => ({ ...f, days_remaining: daysUntil(f.sunset) }));
    const preFixSummary = summarize([...before, ...surfaceBefore]);
    const fixes = options.fix ? applySafeFixes(before, options.dryRun) : [];
    const registryFindings = options.fix && !options.dryRun ? scanFiles(files) : before;
    const surfaceFindings = options.fix && !options.dryRun
      ? scanMigrationSurfaces(files).map((f) => ({ ...f, days_remaining: daysUntil(f.sunset) }))
      : surfaceBefore;
    const findings = [...registryFindings, ...surfaceFindings].sort((a, b) =>
      a.sunset.localeCompare(b.sunset) ||
      a.file.localeCompare(b.file) ||
      a.line - b.line
    );

    const migrationPlan = buildMigrationPlan(
      registryFindings,
      surfaceFindings,
      scanTarget
    );
    if (audit) migrationPlan.target = displayTarget;

    const result = {
      target: displayTarget,
      scan_root: scanTarget,
      source_url: audit ? displayTarget : null,
      generated_at: new Date().toISOString(),
      files_scanned: files.length,
      registry_entries: registry.length,
      mode: options.command === "audit"
        ? (options.diff ? "audit-diff" : options.dryRun ? "audit-dry-run" : "audit")
        : (options.diff ? "diff" : options.dryRun ? "dry-run" : options.fix ? "fix" : "scan"),
      pre_fix_summary: preFixSummary,
      summary: summarize(findings),
      fixes,
      registry_findings: registryFindings,
      surface_findings: surfaceFindings,
      migration_plan: migrationPlan,
      findings
    };

    if (options.htmlPath) {
      fs.mkdirSync(path.dirname(options.htmlPath), { recursive: true });
      fs.writeFileSync(options.htmlPath, renderHtml(result), "utf8");
    }

    if (options.planPath) {
      fs.mkdirSync(path.dirname(options.planPath), { recursive: true });
      fs.writeFileSync(
        options.planPath,
        renderMigrationPlanMarkdown(migrationPlan),
        "utf8"
      );
    }

    if (options.json) {
      const relativeFile = (file) => audit
        ? (path.relative(scanTarget, file) || path.basename(file))
        : file;
      const jsonResult = {
        ...result,
        fixes: fixes.map((f) => ({ ...f, file: relativeFile(f.file) })),
        registry_findings: registryFindings.map((f) => ({ ...f, file: relativeFile(f.file) })),
        surface_findings: surfaceFindings.map((f) => ({ ...f, file: relativeFile(f.file) })),
        findings: findings.map((f) => ({ ...f, file: relativeFile(f.file) }))
      };
      delete jsonResult.scan_root;
      console.log(JSON.stringify(jsonResult, null, 2));
    } else {
      const verb = options.command === "audit" ? "audited" : "scanned";
      console.log(`SunsetDoctor ${verb} ${files.length} files in ${displayTarget}`);
      if (options.diff) printMigrationDiff(fixes, scanTarget);
      else if (options.fix) printFixes(fixes, scanTarget, options.dryRun);
      console.log(
        `Findings: ${result.summary.total} | critical: ${result.summary.critical} | high: ${result.summary.high} | overdue: ${result.summary.overdue}`
      );
      printFindings(findings, scanTarget);
    }

    if (options.command !== "audit") emitActionAnnotations(findings);

    if (options.htmlPath && !options.json) {
      console.log(`HTML report: ${options.htmlPath}`);
    }
    if (options.planPath && !options.json) {
      console.log(`Migration plan: ${options.planPath}`);
    }

    setActionOutput("findings", result.summary.total);
    setActionOutput("fixes", fixes.length);
    setActionOutput("report", options.htmlPath || "");
    setActionOutput("plan", options.planPath || "");
    exitCode = shouldFail(findings, options.failOn) ? 1 : 0;
  } catch (error) {
    console.error(`SunsetDoctor failed: ${error.message}`);
    exitCode = 2;
  }

  if (audit) audit.cleanup();
  process.exit(exitCode);
}

main();
