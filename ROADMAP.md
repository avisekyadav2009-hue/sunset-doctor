# SunsetDoctor Roadmap

## Phase 1 — Free scanner
- [x] Local CLI
- [x] GitHub Action metadata
- [x] Node 24 GitHub Actions runtime
- [x] Text + JSON + HTML reports
- [x] File/line references
- [x] Shutdown countdown
- [x] Replacement suggestions
- [x] Configurable CI failure threshold
- [x] GitHub Action outputs
- [x] Automated tests
- [x] GitHub CI workflow
- [x] Safe model-ID auto-fix + dry-run
- [x] Overlap-safe alias matching
- [x] Registry coverage through February 2027
- [x] PR/file annotations in GitHub Actions
- [x] Security regression tests + least-privilege CI
- [x] Published tagged release (v0.3.0)
- [ ] GitHub Release page

## Phase 2 — Migration assistant
- [ ] Detect SDK version and API surface
- [ ] Generate migration checklist
- [x] Safe codemods for simple model identifier replacements
- [x] Diff mode: before/after safe migrations
- [ ] Validate changed code with tests where available

## Phase 3 — Paid product
- [ ] Private repository scan via GitHub App
- [ ] Scheduled scans + email alerts
- [ ] Team dashboard
- [ ] Model upgrade cost / latency comparison
- [ ] Human migration service for Agent Builder, reusable prompts, and Evals

## Second product candidate
Agent Permission Diff: snapshot MCP / agent tools and permissions in CI, then warn when a PR adds a new write-capable tool, broader scope, unsafe URL access, or credential exposure.
