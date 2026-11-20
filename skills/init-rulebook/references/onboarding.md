# Onboarding and maintenance

Read this reference for `setup`, `fine-tune`, `link-dot-files`, or `update`. `load` needs only the entrypoint unless the index itself points here.

## `setup`: adopt or create a rulebook

1. Identify the active runtime, intended scope, and instruction that invoked this skill. Inspect that host's existing startup pointer first, using [Host discovery](#host-discovery). Judge equivalence by behavior and resolved rulebook path, not exact wording: a working Cursor user rule that invokes this skill and names the rulebook is already a pointer. If it covers the requested startup/compaction scope and no change was requested, preserve it byte-for-byte and proceed directly to `status` and verification in step 5. Do not create another host's bridge or normalize a working pointer's wording.
2. Only for a missing, broken, or explicitly changed setup, inspect the host's effective instruction mechanism, skill availability, rulebook directory, existing index, and source-control state. Reuse the configured rulebook; otherwise default to `~/.agents/AGENTS.md`, or use a requested custom folder. Choose global or project scope from the user's intent, not the storage location. Skill installation alone does not establish startup invocation.
3. Preserve an existing index. If one is missing and creation is requested, write a minimal `AGENTS.md` with its rule paths and applicability. A single-file index is valid; add `rules/` only when conditional loading would save work or clarify boundaries.
4. Only when the requested pointer is absent or needs repair, add or minimally repair it in the active host's effective instructions for that scope. State when to invoke `init-rulebook` and which rulebook to load using that host's supported syntax; no literal invocation phrase is required. Preserve unrelated text and existing equivalent path spellings. If the runtime cannot persist instructions or invoke the skill, report that limitation and offer a manual load request.
5. Run `status` (pass criteria in `SKILL.md` **Status**), then verify discovery in a fresh session, or report it untested with the user's verification step. A file existing on disk does not prove that the runtime loads it.

The index path may be anywhere readable: in dotfiles, a separate checkout, a synced directory, or a plain user folder. The index owns its relative rule links. Do not copy rules into the skill installation or hard-code the user's root in `SKILL.md`.

### Host discovery

Start with the active host's instructions and invocation evidence, not a default filename or another installed client's configuration.

- **Existing pointer, any host:** locate the instruction that invokes this skill, whether a user rule, global instruction, or project instruction. A session started by it proves that a pointer exists; inspect its target and scope before considering edits. Preserve a working pointer and any existing `~/.agents` symlink. A Cursor rule need not resemble a Codex file or use a prescribed phrase.
- **Missing or broken pointer:** inspect the active host's supported persistent-instruction mechanism and skill availability. Configure only that host. `~/.agents/AGENTS.md` is this skill's rulebook convention, not universal native host discovery.
- **Hook-gated host:** a hook that blocks tools until the rulebook load is acknowledged is the user's host configuration. Do not create, edit, disable, or bypass it during setup or status; follow `SKILL.md` **Load and rehydrate**, and report a hook that names a different rulebook or requirement than the pointer and index.

The adapters below cover Codex, Claude Code, and Cursor. Use only the active host's adapter, and only if discovery or repair is needed. In each, the pointer is an instruction sentence that names the skill, the index path, and when to invoke it. Host facts were verified against each host's official documentation on 2026-11-21; recheck for a different runtime version. For any other host, confirm the mechanism in its own documentation instead of borrowing an adapter.

#### Codex adapter — only when Codex is the active host

- Global instructions come from `AGENTS.override.md`, otherwise `AGENTS.md`, in `CODEX_HOME` (default `~/.codex`); Codex uses only the first non-empty file there. Inspect which file is effective before adding a missing pointer. Project instructions follow the repository-to-working-directory chain; use project scope for rules meant only for that project. Codex stops adding files once the combined size reaches `project_doc_max_bytes` (32 KiB by default). The guide documents no import syntax, so write the pointer sentence into the effective file. See [OpenAI's AGENTS.md guide](https://learn.chatgpt.com/docs/agent-configuration/agents-md).
- Codex discovers user skills under `~/.agents/skills/` and project `.agents/skills/` locations. Skill discovery and startup invocation are separate mechanisms. See [OpenAI's skills guide](https://learn.chatgpt.com/docs/build-skills).
- Fresh-session check: the guide's `codex --ask-for-approval never "Summarize the current instructions."` should quote the pointer from the effective file.

#### Claude Code adapter — only when Claude Code is the active host

- User instructions come from `~/.claude/CLAUDE.md` and load in every project. Project instructions come from `./CLAUDE.md` or `./.claude/CLAUDE.md`, with `./CLAUDE.local.md` alongside. Claude Code v2.1.277 or later reads a project `AGENTS.md` natively only when no `CLAUDE.md`, `.claude/CLAUDE.md`, or `CLAUDE.local.md` exists in the working directory or above it. That is project discovery: it never reaches `~/.agents/AGENTS.md`, so the user-level pointer is still required. See [Anthropic's memory guide](https://code.claude.com/docs/en/memory).
- Besides the pointer sentence, a `CLAUDE.md` can import files: an `@path/to/file` reference outside code spans and fenced code blocks expands that file into context with the importing file. Relative paths resolve against the importing file, `@~/` paths reach the home directory, and imports nest at most four hops. Imports load unconditionally, so import at most the index and always-on rules and keep the pointer sentence for conditional rules, action gates, and compaction. In a project file, an import that resolves outside the working directory loads only after the user approves external imports for that project. Cowork desktop sessions skip a user-level import that resolves outside the session's working directory, and a `~/.claude/CLAUDE.md` that is itself a symlink. Judge every import by the native-import test in `SKILL.md`, not by the presence of an `@path` line.
- Personal skills load from `~/.claude/skills/<skill-name>/SKILL.md`, project skills from `.claude/skills/`. See [Anthropic's skills guide](https://code.claude.com/docs/en/skills).
- Fresh-session check: `/context all` lists the instruction files loaded at launch under **Memory files**; the file holding the pointer must appear there.

#### Cursor adapter — only when Cursor is the active host

- User-level instructions are User Rules, set in **Customize → Rules** and applied across all projects. They are not stored on the file system: do not search for or write a file. Give the user the exact pointer text to paste there, and report the pointer unverified until they confirm it. See [Cursor's rules guide](https://cursor.com/docs/context/rules).
- For project scope, Cursor reads `AGENTS.md` in the project root and subdirectories, and project rules stored as `.mdc` files in `.cursor/rules`. It documents no user-level `AGENTS.md`, so `~/.agents/AGENTS.md` needs the pointer.
- A file mention such as `@file` inside a rule is not inlined; the agent reads that file with its tools when needed. It is a pointer, never a native import.
- Cursor loads user skills from `~/.agents/skills/` and `~/.cursor/skills/`, project skills from `.agents/skills/` and `.cursor/skills/`, and for compatibility also from `.claude/skills/`, `.codex/skills/`, `~/.claude/skills/`, and `~/.codex/skills/`. See [Cursor's skills guide](https://cursor.com/docs/context/skills).
- Fresh-session check: **Customize** shows rules and their status, and **Customize → Skills** lists discovered skills.

#### Optional compaction-reload hook

A pointer sentence depends on the model noticing it again after compaction. Where the host runs a hook after compaction, the user may add one that prints the pointer sentence so the reload instruction re-enters context every time. Offer it; add it only on request, show the exact change first, and merge it into the existing hook configuration without replacing other hooks. The hook only prints text: the load itself still follows `SKILL.md`. Host facts verified against official documentation on 2026-11-21.

- **Claude Code:** a `SessionStart` hook with the `compact` matcher runs after compaction, and plain text its command writes to stdout is added to context. Add it to `~/.claude/settings.json` (user) or `.claude/settings.json` (project); `/hooks` lists registered hooks. See [Anthropic's hooks guide](https://code.claude.com/docs/en/hooks-guide#re-inject-context-after-compaction).

  ```json
  {
    "hooks": {
      "SessionStart": [
        {
          "matcher": "compact",
          "hooks": [
            {
              "type": "command",
              "command": "echo 'Context was compacted. Invoke init-rulebook to reload the rulebook before continuing.'"
            }
          ]
        }
      ]
    }
  }
  ```

- **Codex:** hooks are enabled by default and read from `hooks.json` in `CODEX_HOME` (default `~/.codex/hooks.json`), a trusted project's `.codex/hooks.json`, or `[hooks]` in `config.toml`. After Codex compacts a root session, `SessionStart` hooks that match source `compact` run before the next model request, and plain text on stdout is added as developer context. Use the same JSON shape with `"matcher": "^compact$"`. A non-managed hook must be reviewed and trusted before it runs. See [OpenAI's hooks guide](https://learn.chatgpt.com/codex/hooks).

### Verification

For a new or changed pointer, test a fresh session: read an always-on rule and a matching conditional; leave a nonmatching conditional and a future action gate unread. Use only classes the index actually defines. Confirm complete reads and precedence. Report an untested startup or compaction path as untested, even if a manual load succeeds. The user's verification step is the active adapter's fresh-session check, where one exists, followed by an `init-rulebook: status` request in that new session.

Keep personal files and credentials outside the distributed skill. Before writing, inspect existing files and links; preserve unrelated content and obtain the user's informed choice before replacing a directory or link target.

## `fine-tune`: improve selection

Read the index and all rule headings before edits. Map each rule to always-on, conditional, action-gated, or an index-defined category; identify duplicate instructions, unclear triggers, orphaned links, and files that are always read despite narrow applicability. Present specific edits when the requested scope is unclear. Preserve the user's existing priority and authorization rules. After changes, validate inventory and exercise positive and negative trigger cases. Do not shorten a rule by dropping behavior or silently change when a gate opens.

## `link-dot-files`: connect an existing source

1. Identify the dotfiles checkout and the directory containing its `AGENTS.md`. Verify the source is readable and inspect its relative links.
2. Choose either a **direct host pointer** to that index or a **user-requested symlink** from a stable path to the source directory. A symlink is optional when the index's own inventory and links resolve from the pointer path. When the inventory names a stable alias rather than the checkout, leave that sentence unchanged and preserve or create the symlink that makes the alias resolve to the source directory; do not replace the inventory path with the checkout path. The [public example](public-example.md) shows the `~/.agents` case.
3. Before making a symlink, inspect the destination and resolve both ends. If the destination already reaches the same source, leave it alone. If it is another file, directory, or link, show what would be displaced and ask before replacing it. Avoid link loops. Never use a force option as a shortcut.
4. Add or update the host startup pointer only after determining the correct host instruction file. Use the chosen path; keep existing unrelated instructions.
5. Run `status` through the exact pointer the host will use, then verify a fresh session or report it untested with the user's verification step. Report which part is managed by the dotfiles tool and which part is managed by the agent host.

## `update`: refresh one source

An unqualified `init-rulebook: update` refreshes the **installed skill** from its published source. Use `update rules` for the user's rulebook and `update pointer` for a changed startup path. If the source or destination of the requested update is unclear, inspect the existing installation and ask one focused question before replacing files.

| Surface | Procedure |
|---|---|
| Installed `init-rulebook` skill | Identify its install directory and source. Compare local files with the incoming release. Use the chosen installer to verify and copy the published skill into that directory; preserve or review local edits before replacement. Reload the host so it discovers the updated instructions. |
| Git-managed user rulebook | Inspect the checkout and dirty state. Use its documented update path; for a clean Git checkout, a fast-forward-only pull is appropriate when authorized. Preserve local changes and stop on divergence or conflicts. Do not overwrite personal rules with the public example. |
| Startup pointer or dotfiles link | Re-run `link-dot-files` for the changed source path, then `status`. |

Use the installation's recorded GitHub repository and skill subdirectory or published package source. Verify the destination and preview the replacement through its installer. A skill update replaces only the installed skill folder; keep the rulebook and host pointer intact. Never run a broad dotfiles update to refresh this skill. Follow repository-level installation documentation for installer commands.
