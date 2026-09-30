import fs from "node:fs";
import path from "node:path";

const SURFACE_RULES = [
  {
    id: "reusable-prompt-id",
    kind: "api-surface",
    label: "Reusable prompt object",
    regex: /\bpmpt_[A-Za-z0-9_-]+\b/g,
    sunset: "2026-11-30",
    severity: "critical",
    replacement: "Move prompt content into application code and pass instructions/input directly",
    source: "https://developers.openai.com/api/docs/guides/prompting/migrate-from-prompt-object",
    checklist: [
      "Locate the reusable prompt in the OpenAI dashboard while it is still available.",
      "Copy the prompt instructions, variables, and any version-specific behavior into application code.",
      "Replace the saved prompt reference with code-managed instructions/input.",
      "Add representative tests or evals for the migrated prompt behavior.",
      "Deploy behind your normal review/release process and compare outputs before removing the old path."
    ]
  },
  {
    id: "evals-api-endpoint",
    kind: "api-surface",
    label: "OpenAI Evals API",
    regex: /\/v1\/evals(?:\/|\b)/g,
    sunset: "2026-11-30",
    severity: "critical",
    replacement: "Move evaluation workflows to a code-managed evaluation path such as Promptfoo",
    source: "https://developers.openai.com/api/docs/deprecations",
    checklist: [
      "Inventory eval definitions, datasets, graders, and automated runs.",
      "Export or preserve the cases you need before the Evals platform becomes read-only.",
      "Recreate the evaluation workflow in the chosen code-managed evaluation tool.",
      "Run old and new evaluation paths against the same representative cases.",
      "Switch CI or release gates to the replacement workflow before shutdown."
    ]
  },
  {
    id: "evals-sdk-usage",
    kind: "api-surface",
    label: "OpenAI Evals SDK usage",
    regex: /\bclient\.evals(?:\.|\b)/g,
    sunset: "2026-11-30",
    severity: "critical",
    replacement: "Move evaluation workflows to a code-managed evaluation path such as Promptfoo",
    source: "https://developers.openai.com/api/docs/deprecations",
    checklist: [
      "Inventory every client.evals call and the eval/run objects it depends on.",
      "Preserve required datasets, grader logic, and expected outputs.",
      "Port the workflow to the replacement evaluation harness.",
      "Add parity checks using representative evaluation cases.",
      "Remove OpenAI Evals API calls after the replacement passes."
    ]
  },
  {
    id: "agent-builder-workflow-id",
    kind: "platform-surface",
    label: "Agent Builder hosted workflow",
    regex: /\bwf_[A-Za-z0-9_-]{6,}\b/g,
    sunset: "2026-11-30",
    severity: "critical",
    replacement: "Export the workflow as Agents SDK code or migrate to a ChatGPT Workspace Agent",
    source: "https://developers.openai.com/api/docs/guides/agent-builder/migrate-from-agent-builder",
    checklist: [
      "Open the workflow in Agent Builder while export remains available.",
      "Use Code → Agents SDK and export the complete TypeScript or Python implementation.",
      "Inventory tools, control flow, authentication, permissions, and connected apps.",
      "Run representative inputs against both the hosted workflow and exported replacement.",
      "Move ChatKit to an advanced/custom server integration if it currently depends on the hosted workflow ID.",
      "Remove the hosted workflow dependency only after behavioral validation."
    ]
  },
  {
    id: "chatkit-workflow-config",
    kind: "platform-surface",
    label: "ChatKit hosted workflow configuration",
    regex: /\bNEXT_PUBLIC_CHATKIT_WORKFLOW_ID\b/g,
    sunset: "2026-11-30",
    severity: "critical",
    replacement: "Migrate from the Agent Builder-hosted workflow to a server-side agent implementation",
    source: "https://developers.openai.com/api/docs/guides/chatkit",
    checklist: [
      "Identify the Agent Builder workflow referenced by this configuration.",
      "Export the workflow to Agents SDK code.",
      "Move ChatKit to the custom/advanced integration backed by your server-side agent.",
      "Validate user authentication, tools, state, and permissions in the new runtime.",
      "Remove the hosted workflow configuration after cutover."
    ]
  }
];

function lineNumberAt(text, index) {
  return text.slice(0, index).split(/\r?\n/).length;
}

export function scanMigrationSurfaces(files) {
  const findings = [];

  for (const file of files) {
    let text;
    try { text = fs.readFileSync(file, "utf8"); } catch { continue; }

    for (const rule of SURFACE_RULES) {
      rule.regex.lastIndex = 0;
      let match;
      while ((match = rule.regex.exec(text)) !== null) {
        const line = lineNumberAt(text, match.index);
        const lineText = text.split(/\r?\n/)[line - 1] || "";
        findings.push({
          id: rule.id,
          kind: rule.kind,
          label: rule.label,
          match: match[0],
          sunset: rule.sunset,
          severity: rule.severity,
          replacement: rule.replacement,
          source: rule.source,
          checklist: rule.checklist,
          file,
          line,
          excerpt: lineText.trim().slice(0, 240)
        });
        if (match[0].length === 0) rule.regex.lastIndex++;
      }
    }
  }

  const seen = new Set();
  return findings.filter((finding) => {
    const key = [finding.id, finding.file, finding.line, finding.match].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function buildMigrationPlan(findings, surfaceFindings, target) {
  const items = [];

  for (const f of findings) {
    items.push({
      type: f.kind,
      title: f.id,
      evidence: f.excerpt,
      file: path.relative(target, f.file) || path.basename(f.file),
      line: f.line,
      sunset: f.sunset,
      severity: f.severity,
      action: f.replacement,
      source: f.source,
      safe_autofix: f.kind === "model" && /^[A-Za-z0-9._-]+$/.test(f.replacement),
      checklist: f.kind === "model"
        ? [
            "Update the model identifier in code/configuration.",
            "Run the application's existing tests.",
            "Exercise representative production-like requests before deployment."
          ]
        : [
            "Review the official migration guidance.",
            "Map the current behavior and dependencies.",
            "Implement the replacement path and validate before cutover."
          ]
    });
  }

  for (const f of surfaceFindings) {
    items.push({
      type: f.kind,
      title: f.label,
      evidence: f.excerpt,
      file: path.relative(target, f.file) || path.basename(f.file),
      line: f.line,
      sunset: f.sunset,
      severity: f.severity,
      action: f.replacement,
      source: f.source,
      safe_autofix: false,
      checklist: f.checklist
    });
  }
  items.sort((a, b) =>
    a.sunset.localeCompare(b.sunset) ||
    a.file.localeCompare(b.file) ||
    a.line - b.line
  );

  return {
    generated_at: new Date().toISOString(),
    target,
    total_items: items.length,
    safe_autofix_items: items.filter((item) => item.safe_autofix).length,
    manual_items: items.filter((item) => !item.safe_autofix).length,
    items
  };
}

export function renderMigrationPlanMarkdown(plan) {
  const lines = [
    "# SunsetDoctor Migration Plan",
    "",
    `Generated: ${plan.generated_at}`,
    `Target: \`${plan.target}\``,
    "",
    `**Total migration items:** ${plan.total_items}`,
    `**Safe automatic replacements:** ${plan.safe_autofix_items}`,
    `**Manual migration items:** ${plan.manual_items}`,
    ""
  ];

  if (!plan.items.length) {
    lines.push("No known migration work was detected.");
    return lines.join("\n") + "\n";
  }

  plan.items.forEach((item, index) => {
    lines.push(
      `## ${index + 1}. ${item.title}`,
      "",
      `- **Severity:** ${item.severity}`,
      `- **Shutdown:** ${item.sunset}`,
      `- **Location:** \`${item.file}:${item.line}\``,
      `- **Detected:** \`${item.evidence.replaceAll("`", "\\`")}\``,
      `- **Recommended action:** ${item.action}`,
      `- **Safe auto-fix:** ${item.safe_autofix ? "yes" : "no — review required"}`,
      `- **Official guidance:** ${item.source}`,
      "",
      "### Checklist",
      ""
    );
    for (const step of item.checklist) lines.push(`- [ ] ${step}`);
    lines.push("");
  });

  return lines.join("\n") + "\n";
}
