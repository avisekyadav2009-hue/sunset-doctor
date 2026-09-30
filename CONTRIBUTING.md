# Contributing

Thanks for helping improve SunsetDoctor.

## Good contributions

- new verified OpenAI deprecation entries
- false-positive / false-negative reproductions
- additional high-confidence migration-surface detectors
- tests for CLI, GitHub Action, migration-plan, or security behavior
- documentation improvements

## Requirements

1. Add or update tests with behavior changes.
2. Keep automatic fixes conservative.
3. Link new deprecation entries to an official source.
4. Do not commit API keys, credentials, private code, or customer data.
5. Run:

```bash
node --test ./tests/*.test.js
```

before opening a pull request.

## Adding a registry entry

Prefer official OpenAI deprecation documentation. Include the vendor, kind, identifier, sunset date, replacement/migration guidance, severity, and source.

## Design rule

If a migration can change application architecture, authentication, permissions, tool behavior, evaluation logic, or user-visible semantics, SunsetDoctor should generate a checklist instead of silently rewriting it.
