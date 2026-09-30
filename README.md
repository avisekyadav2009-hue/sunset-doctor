# SunsetDoctor

SunsetDoctor scans a codebase for OpenAI models, APIs, and workflow features that are approaching published shutdown dates.

## Why this exists

Deprecation deadlines can silently become production outages. SunsetDoctor turns official shutdown notices into repo-level findings with file/line locations, countdowns, migration guidance, CI failure thresholds, JSON, and HTML reports.

## Current MVP (v0.4.0)

- scans source and config files for known deprecated OpenAI references
- reports file + line + excerpt
- shows shutdown date and live days remaining
- suggests the documented migration/replacement
- supports text and JSON output
- generates a standalone HTML migration report
- configurable CI failure threshold
- GitHub Action support on Node 24
- GitHub Action outputs for finding count and report path
- safe automatic model-ID migrations with `--fix`
- preview migrations without changing files with `--dry-run`
- automated Node test suite and GitHub CI
- overlap-safe matching for model aliases and snapshots
- registry coverage through February 2027
- migration diff preview with `--diff`
- GitHub Actions file/line annotations for deprecations
- CI security regression tests for common credential/token leaks
- explicit least-privilege GitHub Actions permissions

## CLI

```bash
node src/index.js scan /path/to/repo
node src/index.js scan /path/to/repo --json
node src/index.js scan /path/to/repo --html sunset-doctor-report.html
node src/index.js scan /path/to/repo --fail-on high
node src/index.js scan /path/to/repo --dry-run
node src/index.js scan /path/to/repo --fix
node src/index.js scan /path/to/repo --diff
```

### Safe fixes

`--dry-run` previews automatic migrations without changing files. `--diff` presents safe replacements as BEFORE → AFTER changes without editing the project. `--fix` only rewrites unambiguous deprecated model IDs with a single documented replacement. API migrations, platform migrations, and choices with multiple possible replacements remain findings for human review.
### Failure thresholds

`--fail-on` accepts:

- `critical`
- `high`
- `medium`
- `low`
- `any`
- `overdue`
- `never`

The default is `critical`.

## GitHub Action

```yaml
- name: Scan OpenAI deprecations
  uses: avisekyadav2009-hue/sunset-doctor@v0.4.0
  with:
    path: .
    fail-on: critical
    report: sunset-doctor-report.html
```

The Action exposes `findings` and `report` outputs so a workflow can upload the HTML report or use the finding count in later steps.

## Registry

The registry is sourced from OpenAI's official deprecation documentation. Before releases, entries should be rechecked against the official source because shutdown dates and recommended replacements can change.
## Near-term roadmap

1. Add diff mode: before/after migration findings.
2. Add PR annotations/comments.
3. Add migration checks for SDK/API surface changes.
4. Publish the free scanner and GitHub Action.
5. Offer paid migration help for Agent Builder, reusable prompts, and Evals.
