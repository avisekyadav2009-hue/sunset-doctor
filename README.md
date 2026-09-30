# SunsetDoctor

**Detect OpenAI shutdown risks → generate a migration plan → safely fix what can be automated.**

SunsetDoctor scans source/config files for deprecated OpenAI models, APIs, reusable prompts, Evals usage, and Agent Builder-hosted workflows. It reports exact file/line evidence, shutdown dates, migration guidance, CI annotations, and safe model-ID replacements.

> SunsetDoctor is intentionally conservative: it auto-fixes only unambiguous model-ID replacements. Architectural migrations stay human-reviewed.

## Why

A model or platform shutdown can turn into a production incident if the deprecated reference is buried in code, CI, config, or an old integration.

SunsetDoctor is designed to answer four questions:

1. **What will break?**
2. **Where is it used?**
3. **When does it shut down?**
4. **What can be fixed automatically vs. what needs engineering work?**

## What it detects

- deprecated OpenAI model IDs and snapshots
- overdue shutdowns
- reusable prompt IDs such as `pmpt_...`
- OpenAI Evals API / SDK usage
- Agent Builder hosted workflow IDs such as `wf_...`
- ChatKit hosted workflow configuration
- known API/platform shutdown references
- public GitHub repositories via read-only `audit` mode

## Quick start

### Run locally

```bash
git clone https://github.com/avisekyadav2009-hue/sunset-doctor.git
cd sunset-doctor
node src/index.js scan /path/to/your/repo
```

Useful modes:

```bash
# machine-readable output
node src/index.js scan /path/to/repo --json

# HTML report
node src/index.js scan /path/to/repo --html sunset-doctor-report.html

# Markdown migration checklist
node src/index.js scan /path/to/repo --plan sunset-doctor-migration-plan.md

# show safe BEFORE → AFTER migrations without editing
node src/index.js scan /path/to/repo --diff

# preview safe automatic replacements
node src/index.js scan /path/to/repo --dry-run

# apply only unambiguous model-ID replacements
node src/index.js scan /path/to/repo --fix

# audit a public GitHub repo without executing its code
node src/index.js audit https://github.com/owner/repo --plan migration-plan.md --html report.html --fail-on never
```

### GitHub Action

```yaml
- name: Scan OpenAI shutdown risks
  uses: avisekyadav2009-hue/sunset-doctor@v0.6.0
  with:
    path: .
    fail-on: critical
    report: sunset-doctor-report.html
    plan: sunset-doctor-migration-plan.md
```
The Action exposes `findings`, `fixes`, `report`, and `plan` outputs and emits file/line annotations directly in GitHub Actions.

## Demo

The repository contains an intentionally outdated OpenAI integration at:

```text
examples/legacy-openai-app/
```

Run:

```bash
npm run demo
```

SunsetDoctor currently finds four different migration classes in that tiny app:

```text
[CRITICAL] reusable prompt object
[CRITICAL] Agent Builder hosted workflow
[CRITICAL] OpenAI Evals SDK usage
[HIGH]     deprecated GPT-5 snapshot
```

For the model snapshot, SunsetDoctor can propose a safe replacement. For reusable prompts, Agent Builder, and Evals it generates a migration checklist instead of blindly rewriting application architecture.

See [docs/demo.md](docs/demo.md) for a walkthrough.

## CI failure thresholds

`--fail-on` accepts:

- `critical`
- `high`
- `medium`
- `low`
- `any`
- `overdue`
- `never`

Default: `critical`.

## Public repository audits

`audit` accepts only repository-root URLs in the form `https://github.com/<owner>/<repo>`. SunsetDoctor shallow-clones the repository into a temporary directory, scans text/source/config files, produces the requested output, and deletes the temporary clone afterward.

Audit mode never runs `npm install`, package scripts, tests, hooks, or any code from the target repository. It also refuses `--fix` against third-party repositories; use `--dry-run` or `--diff` for previews.

JSON audit output uses the GitHub URL plus relative file paths rather than exposing local temporary paths.

## Safety

SunsetDoctor does **not** need your OpenAI API key to scan a repository.

The project includes:

- regression tests for common API-key/token/private-key signatures
- ignore rules for `.env`, certificates, keys, and credential files
- least-privilege GitHub Actions permissions
- conservative auto-fix rules
- JSON output isolation from GitHub annotation output

See [SECURITY.md](SECURITY.md).
## Migration plans

A generated Markdown plan includes:

- exact file + line
- detected deprecated surface
- shutdown date
- recommended replacement/migration direction
- whether a safe auto-fix exists
- official guidance link
- review checklist for architectural migrations

This makes SunsetDoctor useful as a **migration-audit tool**, not only a deprecation warning.

## Current coverage

The bundled registry tracks 65 OpenAI deprecation/shutdown entries and is checked against OpenAI's official deprecation documentation before releases.

Deprecation schedules can change. Treat the bundled registry as a release snapshot and re-check official documentation for high-stakes migrations.

## Need migration help?

If SunsetDoctor finds an OpenAI migration that is larger than a model-ID replacement, open a **Migration help** issue with sanitized findings. Do not paste secrets, API keys, private source code, or customer data.

We can use the report to scope work such as:

- model/API migrations
- reusable prompt migration
- Agent Builder → Agents SDK migration
- Evals migration
- ChatKit workflow migration
- migration validation and CI hardening

## Development

```bash
node --test ./tests/*.test.js
```

The test suite covers scanning, safe fixes, migration plans, GitHub Action behavior, JSON integrity, overdue shutdowns, and secret-safety regressions.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT
