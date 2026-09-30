#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

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
    if (IGNORE_DIRS.has(path.basename(root))) return out;    for (const name of fs.readdirSync(root)) {
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

function scanFile(file) {
  let text;
  try { text = fs.readFileSync(file, "utf8"); } catch { return []; }
  const lines = text.split(/\r?\n/);
  const findings = [];

  for (const item of registry) {
    const needle = item.id.toLowerCase();
    lines.forEach((line, idx) => {
      if (line.toLowerCase().includes(needle)) {
        findings.push({
          ...item,
          file,
          line: idx + 1,
          excerpt: line.trim().slice(0, 240)
        });
      }
    });
  }
  return findings;
}function daysUntil(dateStr) {
  const now = new Date();
  const end = new Date(dateStr + "T23:59:59Z");
  return Math.ceil((end - now) / 86400000);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const hasCommand = args[0] && !args[0].startsWith("--");
  const command = hasCommand ? args[0] : "scan";
  if (command !== "scan") {
    console.error("Usage: sunset-doctor scan [path] [--json] [--html FILE] [--fail-on LEVEL]");
    process.exit(2);
  }

  let targetArg = ".";
  let json = false;
  let htmlPath = null;
  let failOn = "critical";
  const start = hasCommand ? 1 : 0;

  for (let i = start; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--json") json = true;
    else if (arg === "--html") htmlPath = args[++i];
    else if (arg === "--fail-on") failOn = (args[++i] || "").toLowerCase();
    else if (!arg.startsWith("--") && targetArg === ".") targetArg = arg;
  }  if (process.env.GITHUB_ACTIONS === "true") {
    targetArg = process.env.INPUT_PATH || targetArg;
    failOn = (process.env.INPUT_FAIL_ON || failOn).toLowerCase();
    htmlPath = process.env.INPUT_REPORT || htmlPath;
  }

  const validFail = new Set(["critical", "high", "medium", "low", "any", "overdue", "never"]);
  if (!validFail.has(failOn)) {
    console.error("Invalid --fail-on value. Use critical, high, medium, low, any, overdue, or never.");
    process.exit(2);
  }
  if (htmlPath === undefined) {
    console.error("--html requires a file path.");
    process.exit(2);
  }

  return {
    target: path.resolve(targetArg),
    json,
    htmlPath: htmlPath ? path.resolve(htmlPath) : null,
    failOn
  };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}function summarize(findings) {
  const summary = { total: findings.length, critical: 0, high: 0, medium: 0, low: 0, overdue: 0 };
  for (const f of findings) {
    if (summary[f.severity] !== undefined) summary[f.severity]++;
    if (f.days_remaining < 0) summary.overdue++;
  }
  return summary;
}

function renderHtml(result) {
  const rows = result.findings.map((f) => {
    const rel = path.relative(result.target, f.file) || path.basename(f.file);
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

  const s = result.summary;
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>SunsetDoctor Report</title>
<style>body{font-family:system-ui,-apple-system,Segoe UI,sans-serif;margin:40px;max-width:1200px;color:#171717}
h1{margin-bottom:4px}.muted{color:#666}.cards{display:flex;gap:12px;flex-wrap:wrap;margin:24px 0}
.card{border:1px solid #ddd;border-radius:10px;padding:12px 16px;min-width:110px}.n{font-size:28px;font-weight:700}
table{width:100%;border-collapse:collapse;margin-top:20px}th,td{text-align:left;vertical-align:top;padding:10px;border-bottom:1px solid #e5e5e5}
th{background:#f7f7f7}code{font-size:12px}small{color:#666}</style></head>
<body><h1>SunsetDoctor</h1>
<p class="muted">OpenAI deprecation scan for <code>${escapeHtml(result.target)}</code></p>
<div class="cards">
<div class="card"><div class="n">${s.total}</div><div>Findings</div></div>
<div class="card"><div class="n">${s.critical}</div><div>Critical</div></div>
<div class="card"><div class="n">${s.high}</div><div>High</div></div>
<div class="card"><div class="n">${s.overdue}</div><div>Overdue</div></div>
</div>
<table><thead><tr><th>Severity</th><th>Reference</th><th>Location</th><th>Shutdown</th><th>Migration</th></tr></thead>
<tbody>${rows || '<tr><td colspan="5">No known deprecation references found.</td></tr>'}</tbody></table>
<p class="muted">Generated ${escapeHtml(result.generated_at)} · Registry entries: ${registry.length}</p>
</body></html>`;
}function shouldFail(findings, failOn) {
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

function main() {
  const options = parseArgs();
  const files = walk(options.target);
  const findings = files
    .flatMap(scanFile)
    .map((f) => ({ ...f, days_remaining: daysUntil(f.sunset) }))
    .sort((a, b) =>
      a.sunset.localeCompare(b.sunset) ||
      a.file.localeCompare(b.file) ||
      a.line - b.line
    );

  const result = {
    target: options.target,
    generated_at: new Date().toISOString(),
    files_scanned: files.length,
    registry_entries: registry.length,
    summary: summarize(findings),
    findings
  };  if (options.htmlPath) {
    fs.mkdirSync(path.dirname(options.htmlPath), { recursive: true });
    fs.writeFileSync(options.htmlPath, renderHtml(result), "utf8");
  }

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`SunsetDoctor scanned ${files.length} files in ${options.target}`);
    console.log(`Findings: ${result.summary.total} | critical: ${result.summary.critical} | high: ${result.summary.high} | overdue: ${result.summary.overdue}`);
    if (!findings.length) {
      console.log("No known deprecation references found.");
    } else {
      console.log("");
      for (const f of findings) {
        const rel = path.relative(options.target, f.file) || path.basename(f.file);
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
  }  if (options.htmlPath) {
    console.log(`HTML report: ${options.htmlPath}`);
  }

  setActionOutput("findings", result.summary.total);
  setActionOutput("report", options.htmlPath || "");
  process.exit(shouldFail(findings, options.failOn) ? 1 : 0);
}

main();
