# Repo Settings Contract

Repo-level settings on `t4sh/skills4sh` that the merge / governance flow depends on:

| Setting | Value | Why |
|---|---|---|
| `default_branch` | `main` | All workflows and branch protection target `main`. |
| `delete_branch_on_merge` | `true` | Head branch is auto-deleted on PR merge — no stale branches accumulating. |
| `allow_squash_merge` | `true` | Primary merge strategy — produces single-commit history per PR. |
| `allow_rebase_merge` | `true` | Fallback for series merges that need each commit preserved. |
| `allow_merge_commit` | `false` | No merge commits — required by `required_linear_history: true` on `main`. Removing the UI option keeps the squash/rebase choice unambiguous. |
| `allow_auto_merge` | `false` | Every merge is an explicit human action. |
| `squash_merge_commit_title` | `COMMIT_OR_PR_TITLE` | Use the single commit subject when there's one, else the PR title. |
| `squash_merge_commit_message` | `COMMIT_MESSAGES` | Body composed from commit messages, not PR body (which contains scaffolded template text). |

The full snapshot lives at `.github/repo-settings.expected.json` and is the source of truth. Drift is checked daily and on every PR by `.github/workflows/repo-settings-drift.yml`.

## Changing a setting

1. Change the live setting on github.com (Settings → General → "Pull Requests" section).
2. Update `.github/repo-settings.expected.json` to match, in a PR.
3. The drift check on the PR is the verification step — it fails until the snapshot matches the live value.

## Scope and boundaries

This file covers **repo-wide** settings via `GET /repos/{owner}/{repo}`. Branch-level rules on `refs/heads/main` (required checks, signed commits, linear history, force-push policy, etc.) are governed separately by [`BRANCH_PROTECTION.md`](BRANCH_PROTECTION.md) + `branch-protection.expected.json`.

The two checks are deliberately split because they target different API endpoints, even though both require the same token scope:

| Drift check | Endpoint | Token scope | Required check on `main`? |
|---|---|---|---|
| Branch Protection Drift | `/branches/main/protection` | `Administration: read` (fine-grained PAT) | Yes |
| Repo Settings Drift | `/repos/{owner}/{repo}` | `Administration: read` (fine-grained PAT) | Not yet — promote separately once stable |

Both reuse the same `BRANCH_PROTECTION_TOKEN` repo secret. The default `GITHUB_TOKEN` is not sufficient: admin-gated fields (`delete_branch_on_merge`, `allow_*_merge`, `squash_merge_commit_*`) come back as `null` without Administration scope, which would defeat the drift check.

## Promoting to a required status check

Once this check has run cleanly for a few PR cycles, promote it by:

1. Adding `assert repo-settings matches .github/repo-settings.expected.json` to the `contexts` array in `.github/branch-protection.expected.json`.
2. Adding the same context to live branch protection (Settings → Branches → Edit rule for `main` → Status checks).
3. Both changes in the same PR. Bootstrap the check first; promote second.
