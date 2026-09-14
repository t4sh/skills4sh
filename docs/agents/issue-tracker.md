# Issue Tracker Workflow

This document defines how issues are referenced, tracked, and resolved in this repository.

## Issue References

- GitHub issues are referenced in commit messages with `#<number>`.
- Pull request links use `Closes #<number>` or `Related to #<number>`.
- Issue labels: `feat`, `fix`, `docs`, `refactor`, `security`, `release`.

## Tracking Rules

1. Every feature or fix must reference an issue or include a spec reference.
2. Security fixes must include `.security/*.yaml` updates.
3. Release commits must include version updates and verification results.
4. Review findings are tracked via sub-agent reports (e.g., `review-standards.json`).

## Issue State

- `open` → `in-progress` → `blocked` → `done` → `verified`.
- `verified` requires passing pre-release checks (`npm ci`, `npm test`, `check:pack`, `check:drift`, CRLF scan).
