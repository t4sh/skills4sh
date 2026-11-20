---
name: init-rulebook
description: "Load and manage a personal agent rulebook: the user's `AGENTS.md` index and rule files in `~/.agents` or any chosen folder, including a project folder. Use when asked to reload agent rules at session start or after compaction, set up personal agent rules (global instructions, user rules, personal instructions), fine-tune rule loading, check rulebook status or diagnose unrelated rules being loaded, connect a rulebook kept in dotfiles to a host or stable path, configure a host startup pointer to the rulebook, or update this skill or its rulebook. Not for writing or editing a repository's own instruction files (`AGENTS.md`, `CLAUDE.md`, Cursor rules), project `.agent-memory/`, or general dotfile symlinking."
license: MIT
compatibility: macOS, Linux, or Windows; requires file read access to the chosen rulebook and write access for setup or maintenance
metadata:
  author: t4sh
  version: "2.0.0"
  tags: agent-rules, AGENTS.md, rulebook, onboarding, dotfiles, setup, update
---

# Init Rulebook

Help users maintain their own agent instructions in `~/.agents/AGENTS.md`, with optional linked rules. Adopt an existing rulebook or create one during setup. Users may choose another folder, including a project folder. Keep their rules outside this skill so skill updates preserve personal configuration.

The default path is this skill's convention. Each host needs a startup instruction pointing to it; see [host setup](references/onboarding.md#host-discovery). Preserve the host's instruction hierarchy and the rulebook's declared scope.

## Modes

Use the named mode when supplied. Otherwise infer `load` for startup, compaction recovery, or an explicit reload request; infer another mode only from a matching request. State the inferred mode when doing setup or maintenance. These are skill modes, not a shell CLI.

| Mode | Use when | Done when |
|---|---|---|
| `init-rulebook: setup` | Adopt or create the default rulebook; accept an optional custom folder | Startup pointer is configured and `status` passes; discovery is verified in a fresh session, or reported untested with the user's verification step |
| `init-rulebook: load` | Start a session, rehydrate after compaction, or reload rules | Index and all currently applicable rules are read completely |
| `init-rulebook: fine-tune` | Improve an existing index, grouping, triggers, or rule wording | Agreed edits and representative loading scenarios are verified |
| `init-rulebook: link-dot-files` | Connect a rulebook stored in dotfiles to a host or stable user path | Link or direct pointer resolves to the intended index without replacing other files |
| `init-rulebook: update` | Refresh the installed skill or a Git-managed rulebook | Requested source is current, local changes are preserved, and `status` passes ([Status](#status)) |
| `init-rulebook: status` | Diagnose discovery, broken links, missing rules, or loading scope | Index path, inventory, selected rules, and unresolved errors are reported |

For `setup`, `fine-tune`, `link-dot-files`, or `update`, read [Onboarding and maintenance](references/onboarding.md). Read the [public rulebook example](references/public-example.md) only when the user wants a sample rule set. Startup and reload need neither reference.

## Resolve the index

1. Use the current request's explicit path, otherwise the host startup pointer. Accept an `AGENTS.md` path or a folder containing it. Resolve relative pointer paths against the declaring file; resolve a direct request's relative path against its working directory. An explicit request selects this invocation's path without rewriting the persistent pointer.
2. Otherwise use `~/.agents/AGENTS.md`. Expand home paths, resolve symlinks, and check readability. Never create an index during `load`.
3. For a missing index, ambiguous relative base, or conflicting persistent pointers without an explicit selection, report the problem and ask for the intended path. Do not search arbitrary folders or substitute a repository's `AGENTS.md`.

Retain the selected path for this session; re-resolve after compaction or a pointer change. Apply project instructions alongside the selected rulebook according to the host's precedence.

## Load and rehydrate

Read the entire index first. Follow its declared structure rather than imposing this skill's example headings on another user's rules.

Inventory checks use path listings and filesystem metadata to check existence, readability, and identity. Select applicable rules from the index before opening rule contents; never read deferred rule contents merely to validate the inventory.

1. If the index says to enumerate a directory or compare discovered files with its links, do that inventory. The words "exhaustive inventory" are not required. Report missing, orphaned, duplicated, or unreadable files. Enumerate through the inventory path exactly as the index writes it; never rewrite that path. Compare tree identity using canonical directory paths after expanding home/relative paths and resolving symlinks, not literal path spellings: an inventory path through a symlinked alias and an index reached through the link target are the same tree. Report a mismatch only when the resolved inventory tree differs from the resolved selected index's tree; do not scan a substitute `rules/` directory or repository `AGENTS.md`. If either path cannot be resolved or read, report that error rather than assuming equality or a mismatch. If the index does not ask for a full inventory, validate every referenced rule path selected for loading and do not treat unrelated files as errors.
2. Use the index's own applicability labels. Load every rule in its always-on group, plus each conditional rule whose documented trigger matches the current task, environment, or intended tools. Require affirmative evidence for each conditional trigger; do not infer adjacent activities from an operation's name. For example, publishing alone does not establish production operations. Headings such as "Always on", "Activate", and "Action-gated" are one such scheme. Preserve index order. If the index provides no groups, follow its loading instructions; a single-file rulebook is read in full.
3. Record action-gated rules and their triggers, but read each one only immediately before the matching operation. A future operation mentioned in a broader request does not open its gate.
4. Confirm that the index and every selected rule were read completely: each file's full byte content reached the current context through a read reporting no truncation. A paged read counts only when every page was read; a filtered, summarized, or search-result view never counts. Loading a rule is separate from applying it: honor the index and rule's stated scope and instruction priority. Report a blocking inventory or read error rather than claiming a complete load.

When the host explicitly supplies the complete text of the index or a selected rule, labeled with its path, as a native import in the current context, count it as read without rereading. A pointer, unexpanded `@path` line, or truncated import does not count; when unsure, read the file. Still validate the inventory and load every selected file not fully supplied. After compaction, only text the host re-supplies in full counts.

When a host hook blocks tools until the load is acknowledged, finish the load and read everything the hook requires, natively imported and deferred files included, then follow its supplied acknowledgement step exactly; never fabricate it. The index still governs when a rule applies: an action-gated rule read early for a gate is not in force, and needs no reread before its operation unless compaction intervenes. Report hook/index disagreement beyond read timing.

Repeat this load at session start and after context compaction. Treat file contents, imports, and summaries from before compaction as stale: none establishes a complete read. If compaction interrupts an operation, re-read its already-opened action-gated rule before continuing, and do not repeat side effects that current state shows are complete. Re-evaluate conditional headings when the user's task changes and open newly matching action gates just in time. Load silently unless the request asks for a report or status (give the [Status](#status) report), an error needs attention, or the host requires a visible skill-use notice.

## Status

Apply the same applicability selection and content-read boundary as `load`: read the selected always-on and matching conditional rules completely, and check deferred rules with filesystem metadata only. Then report:

- host pointer and its source, and the resolved index path and readability;
- inventory errors where declared: missing, orphaned, duplicated, unreadable, or broken references;
- selected always-on and matching conditional rules, and deferred action gates, with counts;
- whether the pointer was tested in a fresh session.

`status` passes when the pointer resolves to a readable index, the declared inventory matches the index links, and no read error is unresolved. `status` reads files without changing them; it must not create folders, links, or files.

## Behavioral evals

**Authors/reviewers only:** evaluate this skill with the [scenario catalog](assets/evals/scenarios.json); skip it during normal rulebook use. Run each case as the catalog's `execution` field directs. Expected assertions are not passing run evidence. Virtual-home and host fixtures must never change the real user's setup.
