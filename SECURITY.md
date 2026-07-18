# Security

## Reporting

Email or open a private GitHub security advisory on [fstubner/agent-skills](https://github.com/fstubner/agent-skills) for vulnerabilities in verification scripts or install tooling.

## Scope

- Scripts may scan local project files for secret-like patterns (e.g. client-side keys). That is intentional verification, not exfiltration.
- Do not commit real secrets into `fixtures/`.
- Skills instruct agents; they are not sandboxes. Review agent tool permissions in your harness.
