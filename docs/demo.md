# Demo: from shutdown risk to migration plan

The demo app in `examples/legacy-openai-app` intentionally contains four outdated OpenAI integration patterns.

Run:

```bash
node src/index.js scan ./examples/legacy-openai-app --plan ./sunset-doctor-migration-plan.md --html ./sunset-doctor-report.html --fail-on never
```

Expected finding classes:

```text
CRITICAL  reusable prompt object
CRITICAL  Agent Builder hosted workflow
CRITICAL  OpenAI Evals SDK usage
HIGH      deprecated GPT-5 snapshot
```

What SunsetDoctor does next:

1. It points to the exact file and line for each finding.
2. It shows the shutdown date and migration direction.
3. It marks the deprecated model ID as safe for automatic replacement.
4. It keeps the reusable prompt, Evals, and Agent Builder changes manual.
5. It creates a Markdown migration checklist for those architectural changes.

The intended workflow is:

```text
scan → understand → preview → fix safe items → review architecture → validate → deploy
```

SunsetDoctor does not need an OpenAI API key to perform this repository scan.
