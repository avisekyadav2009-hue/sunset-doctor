# SunsetDoctor

SunsetDoctor scans a codebase for OpenAI models, APIs, and workflow features that are approaching published shutdown dates.

## Why this exists

Deprecation deadlines can silently become production outages. SunsetDoctor turns official shutdown notices into repo-level findings with file/line locations, countdowns, migration guidance, CI failure thresholds, JSON, and HTML reports.

## Current MVP (v0.2.0)

- scans source and config files for known deprecated OpenAI references
- reports file + line + excerpt
- shows shutdown date and live days remaining
- suggests the documented migration/replacement
- supports text and JSON output
- generates a standalone HTML migration report
- configurable CI failure threshold
- GitHub Action support on Node 24
- GitHub Action outputs for finding count and report path

## CLI

```bash
node src/index.js scan /path/to/repo
node src/index.js scan /path/to/repo --json
node src/index.js scan /path/to/repo --html sunset-doctor-report.html
node src/index.js scan /path/to/repo --fail-on high
```
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
  uses: YOUR_GITHUB_USERNAME/sunset-doctor@v0.2.0
  with:
    path: .
    fail-on: critical
    report: sunset-doctor-report.html
```

The Action exposes `findings` and `report` outputs so a workflow can upload the HTML report or use the finding count in later steps.

## Registry

The registry is sourced from OpenAI's official deprecation documentation. Before releases, entries should be rechecked against the official source because shutdown dates and recommended replacements can change.
## Near-term roadmap

1. Add more official OpenAI deprecations and aliases.
2. Add tests for CLI parsing, thresholds, HTML, and GitHub Action environment inputs.
3. Add safe codemods for simple model-ID replacements.
4. Add diff mode: before/after migration findings.
5. Add PR annotations/comments.
6. Publish the free scanner and GitHub Action.
7. Offer paid migration help for Agent Builder, reusable prompts, and Evals.
