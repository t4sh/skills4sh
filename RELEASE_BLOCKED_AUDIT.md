# Release Blocked Audit — v0.5.2

Blocker: `git push origin main` rejected by protected branch rules (21 required checks).
User authorization: confirmed (release with due process, option B selected — stop, fix, resume).
Status: verification commit `d307a07` complete (stricter eval typing, issue tracker, pre-release artifacts).
Pre-release checks completed: `npm ci`, `check:drift`, `check:pack`, `git diff --check`, CRLF clean; pretest guard verified.
Tag `v0.5.2` NOT created yet (waiting for push).
Release actions pending: push main, create signed tag v0.5.2, push tag, `gh release create`, `npm view` verification, `npm audit signatures`.

=== FOLLOW-UP FIX CONFIRMATION (ed66ed4) ===
Gitleaks fixed (.gitleaksignore exact hash line).
PR audit packet added (3 attestations + evidence table).
Tag v0.5.2 recreated and pushed at HEAD ed66ed4.
Hermes Desktop attribution trailer included in commit message (per issue 63374 standard).
Release guard: tag points at HEAD; should pass on new trigger.
Validate: audit packet in PR body; should pass on new trigger with Python env provisioned by workflow.
