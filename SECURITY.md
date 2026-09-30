# Security Policy

## Reporting a security issue

Please do not open a public issue containing secrets, API keys, credentials, private source code, customer data, or exploitable details.

When reporting a security concern, provide the minimum information needed to reproduce it and redact sensitive values.

## Secret handling

SunsetDoctor is designed to scan source trees without requiring an OpenAI API key.

The repository includes protections against accidentally committing common secret material:

- `.env` and local credential files are ignored
- common private-key/certificate formats are ignored
- CI uses least-privilege `contents: read` permissions
- automated tests check tracked files for common token/private-key signatures

These checks reduce risk but cannot prove that every possible secret format is absent. Always review commits before publishing.

## Auto-fix policy

SunsetDoctor automatically rewrites only unambiguous model identifiers with a single replacement. Architectural migrations are reported for human review.
