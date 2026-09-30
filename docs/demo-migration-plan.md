# SunsetDoctor Migration Plan

Generated: 2026-09-30T06:12:53.728Z
Target: `examples/legacy-openai-app`

**Total migration items:** 4
**Safe automatic replacements:** 1
**Manual migration items:** 3

## 1. Reusable prompt object

- **Severity:** critical
- **Shutdown:** 2026-11-30
- **Location:** `app.js:7`
- **Detected:** `const savedPrompt = { id: "pmpt_support_v1" };`
- **Recommended action:** Move prompt content into application code and pass instructions/input directly
- **Safe auto-fix:** no — review required
- **Official guidance:** https://developers.openai.com/api/docs/guides/prompting/migrate-from-prompt-object

### Checklist

- [ ] Locate the reusable prompt in the OpenAI dashboard while it is still available.
- [ ] Copy the prompt instructions, variables, and any version-specific behavior into application code.
- [ ] Replace the saved prompt reference with code-managed instructions/input.
- [ ] Add representative tests or evals for the migrated prompt behavior.
- [ ] Deploy behind your normal review/release process and compare outputs before removing the old path.

## 2. Agent Builder hosted workflow

- **Severity:** critical
- **Shutdown:** 2026-11-30
- **Location:** `app.js:8`
- **Detected:** `const hostedWorkflow = { id: "wf_68df4b13b3588190" };`
- **Recommended action:** Export the workflow as Agents SDK code or migrate to a ChatGPT Workspace Agent
- **Safe auto-fix:** no — review required
- **Official guidance:** https://developers.openai.com/api/docs/guides/agent-builder/migrate-from-agent-builder

### Checklist

- [ ] Open the workflow in Agent Builder while export remains available.
- [ ] Use Code → Agents SDK and export the complete TypeScript or Python implementation.
- [ ] Inventory tools, control flow, authentication, permissions, and connected apps.
- [ ] Run representative inputs against both the hosted workflow and exported replacement.
- [ ] Move ChatKit to an advanced/custom server integration if it currently depends on the hosted workflow ID.
- [ ] Remove the hosted workflow dependency only after behavioral validation.

## 3. OpenAI Evals SDK usage

- **Severity:** critical
- **Shutdown:** 2026-11-30
- **Location:** `app.js:11`
- **Detected:** `await client.evals.runs.create("eval_support_v1", {});`
- **Recommended action:** Move evaluation workflows to a code-managed evaluation path such as Promptfoo
- **Safe auto-fix:** no — review required
- **Official guidance:** https://developers.openai.com/api/docs/deprecations

### Checklist

- [ ] Inventory every client.evals call and the eval/run objects it depends on.
- [ ] Preserve required datasets, grader logic, and expected outputs.
- [ ] Port the workflow to the replacement evaluation harness.
- [ ] Add parity checks using representative evaluation cases.
- [ ] Remove OpenAI Evals API calls after the replacement passes.

## 4. gpt-5-2025-08-07

- **Severity:** high
- **Shutdown:** 2026-12-11
- **Location:** `app.js:6`
- **Detected:** `const model = "gpt-5-2025-08-07";`
- **Recommended action:** gpt-5.6-sol
- **Safe auto-fix:** yes
- **Official guidance:** https://developers.openai.com/api/docs/deprecations

### Checklist

- [ ] Update the model identifier in code/configuration.
- [ ] Run the application's existing tests.
- [ ] Exercise representative production-like requests before deployment.

