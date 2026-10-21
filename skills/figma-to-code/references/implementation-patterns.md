# Figma Implementation Patterns

Repository-convention detail for the commands in `SKILL.md`. Prefer the active MCP server's schema over any parameter name here. When `figma-design-to-code` is installed it owns design-context retrieval and implementation; the [Targeting](#targeting) and [Asset Rules](#asset-rules) sections apply only to the fallback procedure.

## Command Routing

If a request mixes commands, choose order from the user's intent instead of applying a fixed pipeline:

- Run tokens before implementation only when token parity is part of the request or the design uses unfamiliar variables.
- Run rules before implementation only when the user asked for durable workflow guidance or the repo lacks Figma-to-code conventions.
- Run Code Connect after implementation only when the mapping depends on newly created code components; run it before when the user wants generation to reuse existing mapped components.

Ask for confirmation before writing durable rule files or submitting mappings when the user's wording is exploratory.

## Conventions Brief

Record the provisional brief in working notes after repository inspection and before design-context retrieval, then update that note after retrieval and before implementation. Do not defer the provisional checkpoint to the completion summary. No committed brief file is needed unless asked. Keep it scoped to the target: the draft records repository candidates and marks Figma mappings pending; do not infer Figma variable names, values, or component instances from repository files alone.

| Section | Contents |
|---|---|
| Stack | Language, framework, styling approach, import aliases, formatting conventions confirmed from the repository |
| Token map | After retrieval: Figma variable or raw value → repository token, chosen by semantic role; unmapped entries with a reason |
| Component reuse map | After retrieval: Figma component or instance → repository component import path and the props or variants that express it; existing Code Connect mappings from `get_code_connect_map` when available |
| Rule constraints | Paths and "never do this" rules from the repository's agent rules files that apply to the target |
| Asset policy | Where static assets live and how they are imported; icon source of truth |

When `figma-design-to-code` runs the implementation, apply the provisional repository conventions to its retrieval step, then finalize the mappings from the context it retrieved before code is written. Do not re-request context or screenshot; continue its procedure with the finalized brief.

## Targeting

Prefer Figma's Remote MCP for shared links and repository work. Use Desktop MCP when the user says "the selected frame" or their organization requires it; call the tool without `fileKey` when the schema supports selection-based access.

Remote MCP needs a durable target. Pass the full URL when the tool accepts URLs; parse fields only when the schema asks for them. Accept `figma.com` and `www.figma.com`, and `/design/`, `/file/`, and `/proto/` paths. Convert URL node IDs such as `42-15` to `42:15` only when the tool requires the colon form.

Branch URLs have the shape `https://www.figma.com/design/:fileKey/branch/:branchKey/:fileName?node-id=42-15`. Preserve the full URL when accepted. When a tool requires separate fields and returns file-not-found, retry once with **`branchKey` as `fileKey`**.

Links without `node-id`: ask for a specific frame or component URL unless the user explicitly wants the whole file inspected. Prototype links may point to a flow; ask for the exact source frame before coding.

## Asset Rules

- Use MCP-provided image and SVG sources first, including `localhost` asset URLs, and persist them through the repository's asset pipeline.
- Do not add an icon package because an icon appears in Figma, and do not create grey boxes, lorem images, or approximate SVGs when the payload provides an asset.
- If an asset cannot be retrieved, record the exact layer name and ask for the source before claiming visual parity.

## Correction Loop

Figma context plus the screenshot are the acceptance spec; the repository conventions brief is the convention spec. A single implement pass without correction is incomplete. Use the context and screenshot already retrieved by whichever procedure implemented the design.

### Per-unit correction

After each component or region:

1. Extract expected values from Figma context: spacing, font size and weight, colors, radius, gap, alignment.
2. Compare to the code just written, including class names and tokens.
3. List **specific** mismatches — e.g. `gap is gap-4 (16px); Figma auto-layout gap is 24px` — and convention breaks such as a raw hex value where the token map names a token, or new markup where the reuse map names a component.
4. Fix all listed issues in one edit when practical.
5. Re-check. **Stop after two correction passes** per unit unless the user requests more.

### Assembly correction

After all regions are integrated, compare the full page to the root screenshot for section spacing, background, max-width, sticky headers, and grid alignment; check one desktop and one mobile width when the design implies responsiveness. Run one assembly pass; a second only if major layout drift remains.

### Visual correction with a running app

Prefer the **`localhost-screenshots`** skill for breakpoint captures; otherwise use the host browser tooling against the running URL. Fix drift before marking complete.

### When to skip heavy correction

- User asked for a rough scaffold or wireframe parity only.
- MCP access failed and the user accepted reduced fidelity.
- Change is a one-line token swap with no layout impact.

Document skipped correction and remaining risk in the completion summary.

## Token Extraction

1. Read the variable definitions for the target.
2. Read the project's token files before editing.
3. Map by semantic role before raw value: `color.background.surface` beats `gray-50` if that is the local pattern.
4. Keep aliases intact when Figma uses primitive-to-semantic layering.
5. Add only tokens needed by the requested work unless the user asks for a broader migration.
6. Run the project's formatting and token validation checks when present.

## Design-System Rules

1. Inspect the repository: package metadata, component directories, styling approach, token files, icons, image handling, tests, stories, and existing agent rule files.
2. Treat output from the `create_design_system_rules` prompt as a draft when the user runs it; otherwise build rules from step 1.
3. Write for the active agent target. Prefer an existing repo convention over this table, and a focused Figma section over rewriting broad root instructions:

| Agent | Rule file |
|---|---|
| Default / Codex / Grok / OpenClaw / Copilot | `AGENTS.md` or a project-local `AGENTS.md` in the affected package |
| Claude Code | `CLAUDE.md` with `@AGENTS.md`, or a focused Figma section under an existing Claude pointer |
| Cursor | `.cursor/rules/figma-design-system.mdc` |
| Windsurf | `.windsurfrules` |
| Cline | `.clinerules` |
| Roo Code | `.roo/rules/figma-design-system.md` or `.roo/rules-code/figma-design-system.md` |
| Continue | `.continue/rules/figma-design-system.md` |
| Generic agents | `.agents/rules/figma-design-system.md` or the repository's documented agent-rule path |

4. Cover these topics with repository-specific guidance:
   - Component locations and naming
   - Layout primitives and composition patterns
   - Token and theme usage
   - Asset handling and icon policy
   - Figma MCP retrieval flow, naming `figma-design-to-code` when the team uses it
   - Visual verification expectations
   - Known anti-patterns for this repository
5. Keep rules concise enough to be read on every relevant task, and preserve unrelated instructions.

## Code Connect

1. Confirm the task is Code Connect, not ordinary implementation.
2. When the host provides **`figma-code-connect`** or a native Code Connect workflow, use this skill to plan and validate mappings and that workflow for template authoring and submission once the user approves.
3. Confirm the Figma target is a component, component set, or instance of a published library component; arbitrary frames are not mappable.
4. Confirm access: `whoami` plan and seat (stop with a clear blocker when ineligible), a connected Figma MCP server, Code Connect tools or a native workflow, and access to both the library and the repository.
   - **MCP templates:** `.figma.ts` files via **`figma-code-connect`**.
   - **CLI/parser:** `figma.connect()` in `.figma.tsx` files with a Figma token that can read the file and write Code Connect metadata.
5. Confirm the code side is map-ready: stable import path, props and variants in the public API, real representations for icons, slots, and children, and stories or clear source.
6. Read existing mappings with `get_code_connect_map`. Consume Figma-prompted suggestions only when the server or `figma-code-connect` surfaces them.
7. Map Figma variants, booleans, sizes, and slots to actual code props and children; mark unsupported properties as intentionally unmapped instead of inventing props.
8. Write a mapping with `add_code_connect_map` only after the user approves it, then read it back with `get_code_connect_map`.
