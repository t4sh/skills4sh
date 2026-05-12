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

The two checks are deliberately split because they target different API endpoints **and** need different token mechanics:

| Drift check | Endpoint | Token mechanism | Required check on `main`? |
|---|---|---|---|
| Branch Protection Drift | `/branches/main/protection` | Fine-grained PAT, `Administration: read` (`BRANCH_PROTECTION_TOKEN`) | Yes |
| Repo Settings Drift | `/repos/{owner}/{repo}` | GitHub App installation token, `Administration: read` (`REPO_SETTINGS_APP_ID` + `REPO_SETTINGS_APP_PRIVATE_KEY`) | Not yet — promote separately once stable |

The reason the two checks use different mechanisms: empirically (verified on this PR's first two CI runs), `GET /repos/{owner}/{repo}` returns admin-gated fields (`delete_branch_on_merge`, `allow_*_merge`, `squash_merge_commit_*`) as `null` when called with a fine-grained PAT — even one that has `Administration: read` and works fine for `/branches/main/protection`. Classic OAuth tokens with `repo` scope return the fields, but the broad scope is the wrong tradeoff for a read-only governance check. GitHub App installation tokens with the same `Administration: read` permission do return the fields.

## Setup

One-time configuration for the Repo Settings Drift check:

1. **Create a private GitHub App** at <https://github.com/settings/apps/new>
   - **GitHub App name**: e.g. `skills4sh-repo-settings-drift` (must be globally unique)
   - **Homepage URL**: <https://github.com/t4sh/skills4sh>
   - **Webhook**: untick "Active" (no callbacks needed)
   - **Repository permissions** → **Administration**: Read-only
   - **Where can this GitHub App be installed?**: Only on this account
   - Click **Create GitHub App**.
2. **Generate a private key** on the App settings page (scroll down to "Private keys" → "Generate a private key"). A `.pem` file downloads.
3. **Note the App ID** at the top of the App settings page (it's a numeric ID, not the slug).
4. **Install the App** on this repo: App settings sidebar → **Install App** → click **Install** on your account → **Only select repositories** → check `skills4sh` → **Install**.
5. **Add repo secrets** at <https://github.com/t4sh/skills4sh/settings/secrets/actions>:
   - `REPO_SETTINGS_APP_ID` — the numeric App ID from step 3.
   - `REPO_SETTINGS_APP_PRIVATE_KEY` — paste the full contents of the `.pem` file (including the `-----BEGIN`/`END` lines).

The App needs no write permissions and is installed on exactly one repo. The private key is the only sensitive material; rotate it from the App settings page if it ever leaks.

## Fallback if the App approach also returns null

If after Setup the workflow still emits the "App installation token returned null for every admin-gated field" diagnostic, the App permission model has the same gap as fine-grained PATs (unlikely but possible). The next escalation is a classic OAuth token with `repo` scope, stored as a separate secret. This trades scope discipline for working drift detection — decide explicitly rather than silently widening.

## Promoting to a required status check

Once this check has run cleanly for a few PR cycles, promote it by:

1. Adding `assert repo-settings matches .github/repo-settings.expected.json` to the `contexts` array in `.github/branch-protection.expected.json`.
2. Adding the same context to live branch protection (Settings → Branches → Edit rule for `main` → Status checks).
3. Both changes in the same PR. Bootstrap the check first; promote second.
