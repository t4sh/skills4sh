# skills4sh

[![OWASP AST10](https://img.shields.io/badge/OWASP-Agentic_Skills_Top_10-blue?logo=owasp)](SECURITY.md)
[![guardskills](https://img.shields.io/badge/guardskills-SAFE-brightgreen)](https://www.npmjs.com/package/guardskills)
[![Known Vulnerabilities](https://snyk.io/test/github/t4sh/skills4sh/badge.svg)](https://snyk.io/test/github/t4sh/skills4sh)
[![CodeQL](https://github.com/t4sh/skills4sh/actions/workflows/codeql.yml/badge.svg)](https://github.com/t4sh/skills4sh/actions/workflows/codeql.yml)

Agent skills for Claude Code, Cursor, Windsurf, Cline, and other AI coding agents.

## Skills

| Skill | Description | Version |
|-------|-------------|---------|
| [agent-memory](skills/agent-memory/) | Cross-interface persistent memory system for any project | 2.2 |
| [discord-harvest](skills/discord-harvest/) | Extract and download images, links, and files from Discord conversations | 1.0.0 |
| [localhost-screenshots](skills/localhost-screenshots/) | Localhost screenshot capture and visual regression testing | 1.0.0 |

## Install

```bash
# List available skills
npx skills add t4sh/skills4sh --list

# Install a specific skill
npx skills add t4sh/skills4sh --skill agent-memory

# Install all skills
npx skills add t4sh/skills4sh --all
```

---

## Skill structure

Each skill follows the [Agent Skills specification](https://agentskills.io/specification):

```
skills/<skill-name>/
├── SKILL.md          # Required: metadata + instructions
└── reference/        # Supporting documentation
```

## Security

### OWASP Agentic Skills Top 10 (AST10)

This repository implements controls for all 10 risks in the [OWASP Agentic Skills Top 10](https://owasp.org/www-project-agentic-skills-top-10/):

| Risk | Control | Implementation |
|------|---------|----------------|
| **AST01** Malicious Skills | Content integrity | SHA-256 hashes in `skills-lock.json` and `.security/` manifests |
| **AST02** Supply Chain Compromise | Immutable lock file | All files pinned to exact hashes; CI drift detection |
| **AST03** Over-Privileged Skills | Minimal permissions | Each skill declares only needed permissions with rationale |
| **AST04** Insecure Metadata | Validated frontmatter | CI checks name/directory match; `metadata.repository` links to canonical source |
| **AST05** Unsafe Deserialization | Declarative config only | SKILL.md frontmatter is metadata only; no executable YAML |
| **AST06** Weak Isolation | Execution context declared | Network and filesystem scope documented per skill |
| **AST07** Update Drift | Version pinning | CI verifies SKILL.md versions match `skills-lock.json` |
| **AST08** Poor Scanning | Multi-layer scanning | guardskills + Snyk + CodeQL on every PR |
| **AST09** No Governance | Security policy | `SECURITY.md` with disclosure process; PR review checklist |
| **AST10** Cross-Platform Reuse | Canonical manifests | `.security/<name>.yaml` per skill; platform manifests generated from it |

See [SECURITY.md](SECURITY.md) for the full compliance mapping, vulnerability disclosure process, and expected findings.

### Security scanning

All skills pass [guardskills](https://www.npmjs.com/package/guardskills) with a **SAFE** rating:

```bash
npx guardskills add t4sh/skills4sh --skill agent-memory --dry-run
npx guardskills add t4sh/skills4sh --skill discord-harvest --dry-run
npx guardskills add t4sh/skills4sh --skill localhost-screenshots --dry-run
```

Skills contain no shell scripts or executable code — only SKILL.md instructions and reference documentation.

## License

MIT
