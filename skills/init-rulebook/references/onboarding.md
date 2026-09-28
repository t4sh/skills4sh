# Onboarding and maintenance

Read this reference for `setup`, `fine-tune`, `link-dot-files`, or `update`. `load` needs only the entrypoint unless the index itself points here.

## `setup`: adopt or create a rulebook

1. Identify the active runtime, intended scope, and instruction that invoked this skill. Inspect that host's existing startup pointer first, using [Host discovery](#host-discovery). Judge equivalence by behavior and resolved rulebook path, not exact wording: a working Cursor user rule that invokes this skill and names the rulebook is already a pointer. If it covers the requested startup/compaction scope and no change was requested, preserve it byte-for-byte and proceed directly to `status` and verification in step 5. Do not create another host's bridge or normalize a working pointer's wording.
2. Only for a missing, broken, or explicitly changed setup, inspect the host's effective instruction mechanism, skill availability, rulebook directory, existing index, and source-control state. Reuse the configured rulebook; otherwise default to `~/.agents/AGENTS.md`, or use a requested custom folder. Choose global or project scope from the user's intent, not the storage location. Skill installation alone does not establish startup invocation.
3. Preserve an existing index. If one is missing and creation is requested, write a minimal `AGENTS.md` with its rule paths and applicability. A single-file index is valid; add `rules/` only when conditional loading would save work or clarify boundaries.
4. Only when the requested pointer is absent or needs repair, add or minimally repair it in the active host's effective instructions for that scope. State when to invoke `init-rulebook` and which rulebook to load using that host's supported syntax; no literal invocation phrase is required. Preserve unrelated text and existing equivalent path spellings. If the runtime cannot persist instructions or invoke the skill, report that limitation and offer a manual load request.
5. Run `status`, then verify discovery in a fresh session. A file existing on disk does not prove that the runtime loads it.

The index path may be anywhere readable: in dotfiles, a separate checkout, a synced directory, or a plain user folder. The index owns its relative rule links. Do not copy rules into the skill installation or hard-code the user's root in `SKILL.md`.

### Host discovery

Start with the active host's instructions and invocation evidence, not a default filename or another installed client's configuration.

- **Existing pointer, any host:** locate the instruction that invokes this skill, whether a user rule, global instruction, or project instruction. A session started by it proves that a pointer exists; inspect its target and scope before considering edits. Preserve a working pointer and any existing `~/.agents` symlink. A Cursor rule need not resemble a Codex file or use a prescribed phrase.
- **Missing or broken pointer:** inspect the active host's supported persistent-instruction mechanism and skill availability. Configure only that host. `~/.agents/AGENTS.md` is this skill's rulebook convention, not universal native host discovery.

#### Codex adapter — only when Codex is the active host

Use this adapter only if discovery or repair is needed for Codex. Verified against official documentation on 2026-09-27; recheck for a different runtime version.

- Global instructions come from `AGENTS.override.md`, otherwise `AGENTS.md`, in `CODEX_HOME` (default `~/.codex`). Inspect which file is effective before adding a missing pointer. Project instructions follow the repository-to-working-directory chain; use project scope for rules meant only for that project. See [OpenAI's AGENTS.md guide](https://developers.openai.com/codex/guides/agents-md).
- Codex discovers user skills under `~/.agents/skills/` and project `.agents/skills/` locations. Skill discovery and startup invocation are separate mechanisms. See [OpenAI's skills guide](https://developers.openai.com/codex/skills).

### Verification

For a new or changed pointer, test a fresh session: read an always-on rule and a matching conditional; leave a nonmatching conditional and a future action gate unread. Use only classes the index actually defines. Confirm complete reads and precedence. Report an untested startup or compaction path as untested, even if a manual load succeeds.

Keep personal files and credentials outside the distributed skill. Before writing, inspect existing files and links; preserve unrelated content and obtain the user's informed choice before replacing a directory or link target.

## `fine-tune`: improve selection

Read the index and all rule headings before edits. Map each rule to always-on, conditional, action-gated, or an index-defined category; identify duplicate instructions, unclear triggers, orphaned links, and files that are always read despite narrow applicability. Present specific edits when the requested scope is unclear. Preserve the user's existing priority and authorization rules. After changes, validate inventory and exercise positive and negative trigger cases. Do not shorten a rule by dropping behavior or silently change when a gate opens.

## `link-dot-files`: connect an existing source

1. Identify the dotfiles checkout and the directory containing its `AGENTS.md`. Verify the source is readable and inspect its relative links.
2. Choose either a **direct host pointer** to that index or a **user-requested symlink** from a stable path to the source directory. A symlink is optional when the index's own inventory and links resolve from the pointer path. When the index inventories `~/.agents/rules/*.md`, `~/.agents` is the tree: leave that sentence unchanged, and preserve or create the symlink that makes `~/.agents` the source `agents/` directory. Do not replace the inventory path with the checkout path.
3. Before making a symlink, inspect the destination and resolve both ends. If the destination already reaches the same source, leave it alone. If it is another file, directory, or link, show what would be displaced and ask before replacing it. Avoid link loops. Never use a force option as a shortcut.
4. Add or update the host startup pointer only after determining the correct host instruction file. Use the chosen path; keep existing unrelated instructions.
5. Run `status` through the exact pointer the host will use and verify a fresh session. Report which part is managed by the dotfiles tool and which part is managed by the agent host.

## `update`: refresh one source

An unqualified `init-rulebook: update` refreshes the **installed skill** from its published source. Use `update rules` for the user's rulebook and `update pointer` for a changed startup path. If the source or destination of the requested update is unclear, inspect the existing installation and ask one focused question before replacing files.

| Surface | Procedure |
|---|---|
| Installed `init-rulebook` skill | Identify its install directory and source. Compare local files with the incoming release. Use the chosen installer to verify and copy the published skill into that directory; preserve or review local edits before replacement. Reload the host so it discovers the updated instructions. |
| Git-managed user rulebook | Inspect the checkout and dirty state. Use its documented update path; for a clean Git checkout, a fast-forward-only pull is appropriate when authorized. Preserve local changes and stop on divergence or conflicts. Do not overwrite personal rules with the public example. |
| Startup pointer or dotfiles link | Re-run `link-dot-files` for the changed source path, then `status`. |

Use the installation's recorded GitHub repository and skill subdirectory or published package source. Verify the destination and preview the replacement through its installer. A skill update replaces only the installed skill folder; keep the rulebook and host pointer intact. Never run a broad dotfiles update to refresh this skill. Follow repository-level installation documentation for installer commands.

## `status`: evidence to report

Inspect the host pointer, resolved index path, readability, linked-file inventory where declared, selected always-on and matching conditional rules, deferred action gates, and any broken or duplicate references. State whether the pointer was tested in a fresh session. A read-only status check must not create folders, links, or files.
