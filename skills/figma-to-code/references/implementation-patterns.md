# Figma Implementation Patterns

Use these patterns when the main skill flow needs more detail. Prefer the active MCP server's schema over any example parameter name here.

## Command Routing

Use one command per request:

- `/figma-to-code implement`: build or update code from a Figma frame, component, page, or selection.
- `/figma-to-code tokens`: extract, compare, or import Figma variables into the repository token system.
- `/figma-to-code rules`: create durable Figma-to-code rules for `AGENTS.md`, `CLAUDE.md`, Cursor rules, or similar agent guidance.
- `/figma-to-code code-connect`: map published Figma components to real code components using Code Connect tooling.

If a request mixes commands, choose order from the user's intent instead of applying a fixed pipeline. Typical dependencies:

- Extract tokens before implementation only when token parity is part of the request or the design uses unfamiliar variables.
- Generate rules before implementation only when the user asked for durable workflow guidance or the repo lacks Figma-to-code conventions.
- Perform implementation before Code Connect only when the mapping depends on newly created code components.
- Run Code Connect before implementation only when the user wants the MCP server to reuse existing mapped components during generation.

Ask for confirmation before writing durable rule files or submitting mappings when the user's wording is exploratory.

## Desktop MCP vs Remote MCP

Desktop MCP can usually operate from the current Figma Desktop selection. When the user says "use the selected frame" and no URL is provided, call the relevant tool without `fileKey` if the schema supports selection-based access. If the tool asks for `nodeId`, pass the selected node ID in the format the tool expects.

Remote MCP needs a durable Figma target. Prefer passing the full Figma URL when the tool accepts URLs. Accept both `figma.com` and `www.figma.com` hosts, modern design URLs, legacy file URLs, prototype URLs, and branch URLs. Parse separate fields only when the tool schema asks for them:

- `https://www.figma.com/design/:fileKey/:fileName?node-id=42-15`
- `https://figma.com/design/:fileKey/:fileName?node-id=42-15`
- `https://www.figma.com/file/:fileKey/:fileName?node-id=42-15`
- `https://www.figma.com/proto/:fileKey/:fileName?...&node-id=42-15`
- `fileKey`: `:fileKey`
- URL node ID: `42-15`
- Colon node ID, only if needed: `42:15`

Branch URLs use the shape `https://www.figma.com/design/:fileKey/branch/:branchKey/:fileName?node-id=42-15`. Preserve the full URL when the tool accepts URLs. On the first attempt, do not pass `branchKey` as `fileKey`. If a remote tool that requires separate `fileKey` and `nodeId` returns file-not-found or invalid file access, retry once with **`branchKey` as `fileKey`**. If the server does not expose branch parameters, use the desktop selection inside the branch or ask for a canonical node URL from the intended branch.

Links without `node-id` require an intent check. Desktop MCP can use the selected node in the open file. Remote MCP should ask for a specific frame/component node URL unless the user explicitly asks to inspect the whole file first. Prototype links without a node may point to a flow, not an implementation frame; ask the user to select or share the exact source frame before coding.

## Asset Rules

Use the Figma MCP payload as the first source for images, SVGs, logos, and icons.

- Use `localhost` image or SVG sources directly when the MCP server provides them.
- Download or copy MCP-served assets through the repository's normal asset pipeline when persistent source files are needed.
- Do not add a new icon package solely because an icon appears in Figma.
- Do not create grey boxes, lorem image placeholders, or approximate SVGs when the MCP payload already provides an asset source.
- If an asset cannot be retrieved, record the exact layer or asset name and ask for the missing source before claiming visual parity.

## Truncated Context Recovery

Large frames often exceed a single `get_design_context` response. When context is truncated, too broad, or missing visible child layers:

1. Keep or refresh the full-frame screenshot as the visual source of truth.
2. Call metadata for the parent frame to get child node IDs, names, and hierarchy.
3. Identify major regions such as header, sidebar, hero, table, card grid, modal, footer, or repeated component set.
4. Fetch design context for the smallest child node that still represents each region.
5. Implement each region against project components, then compare the assembled page against the full-frame screenshot.

If child context still truncates, repeat the metadata narrowing one level deeper. Avoid implementing from partial data without marking the uncertainty.

## MCP Call Budget

Use the active server schema; tool names below are the common Figma MCP set.

### Analysis batch (once per frame or page)

| Call | When | Skip when |
|------|------|-----------|
| `get_metadata` | Frame has many children or prior context truncated | Single small component with complete context |
| `get_variable_defs` | Tokens/variables needed for colors, spacing, type | Unit uses only existing project tokens |
| `get_screenshot` | Visual source of truth for implement or correction | Never skip for implement unless user accepts reduced fidelity |

Run independent analysis calls in parallel when the host supports it.

### Per implementation unit

| Call | When | Skip when |
|------|------|-----------|
| `get_design_context` | Each leaf region or component to build | Local component already maps via Code Connect and design is satisfied |
| `get_screenshot` | Context lacks visual reference | Context includes an embedded screenshot or preview |
| `get_variable_defs` | — | Already fetched on root for this frame |

### Call estimates

For **N** implementation units under one frame:

| Strategy | Approx. MCP calls |
|----------|-------------------|
| Naive (context + screenshot + variables per unit) | **3N** |
| Official implement-design style (context + screenshot per unit, variables once) | **2N + 1** |
| **This skill (budgeted)** | **N + 2–3** (metadata/variables/screenshot once + N contexts) |

### Decomposition rules

- **Single component or card:** one `get_design_context`; no metadata pass unless truncated.
- **Page or dashboard:** metadata first → implement regions bottom-up or outside-in (layout shell → sections → atoms).
- **Reuse:** if a Figma instance maps to an existing repo component via Code Connect, implement by extending that component — no duplicate context fetch.
- **Rate limits:** if limited, prioritize metadata + screenshot on root, then context for the highest-risk regions only; document skipped regions.

## Correction Loop

Figma context plus the screenshot are the acceptance spec. A single implement pass without correction is incomplete for `/figma-to-code implement`.

### Per-unit correction

After implementing one component or region:

1. Extract expected values from Figma context (spacing, font size/weight, colors, radius, gap, alignment).
2. Compare to the code just written (class names, tokens, computed layout).
3. List **specific** mismatches, not vague notes — e.g. `gap is gap-4 (16px); Figma auto-layout gap is 24px`.
4. Fix all listed issues in one edit when practical.
5. Re-check against context/screenshot. **Stop after two correction passes** per unit unless the user requests more.

### Assembly correction

After all regions are integrated:

1. Compare full page to the root screenshot: section spacing, page background, max-width, sticky headers, grid alignment.
2. Check responsive behavior at one desktop and one mobile width when the design implies responsiveness.
3. Run one assembly correction pass; two only if major layout drift remains.

### Visual correction with a running app

When a local dev server or preview route exists:

1. Prefer the **`localhost-screenshots`** skill for breakpoint captures.
2. Otherwise use the host browser MCP against the running URL.
3. Compare rendered output to the Figma screenshot; fix drift before marking complete.

### When to skip heavy correction

- User asked for a rough scaffold or wireframe parity only.
- MCP access failed and the user accepted reduced fidelity.
- Change is a one-line token swap with no layout impact.

Document skipped correction and remaining risk in the completion summary.

## Examples

### Button Component

Request: "Implement this Figma button component."

1. Get design context for the selected component or URL node.
2. Get a screenshot for the same node before editing.
3. Check the repository for existing button primitives and variant APIs.
4. Map Figma variants such as size, tone, icon position, disabled, hover, and focus into the existing API.
5. Use project tokens for color, radius, spacing, typography, and focus state when equivalent tokens exist.
6. Run the per-unit correction loop (up to two passes) against context and screenshot.
7. Add or update stories/tests only if the repository already uses them for similar components.

### Dashboard or Page Frame

Request: "Build this dashboard frame."

1. Try full-frame design context.
2. Get a full-frame screenshot before editing.
3. If full context is too large, use metadata to split into regions.
4. Implement layout structure first with project layout primitives.
5. Implement repeated cards, tables, charts, and filters as reusable local components only when reuse is real.
6. Run per-region correction, then an assembly correction pass against the full-frame screenshot.
7. Validate desktop and mobile behavior against Figma constraints; if Figma has no mobile frame, make the smallest conservative responsive adaptation and document it.

### Token Extraction

Request: "Extract the Figma variables into our code tokens."

1. Call the variable definitions tool.
2. Read the project's token files before editing.
3. Map by semantic role before raw value: `color.background.surface` beats `gray-50` if that is the local pattern.
4. Keep aliases intact when Figma uses primitive-to-semantic layering.
5. Add only tokens needed by the requested implementation unless the user asks for a broader migration.
6. Run the project's formatting and token validation checks when present.

### Design-System Rules

Request: "Create Figma guidelines for this repo" or "generate design system rules."

1. Inspect the repository before generating rules: package metadata, component directories, styling approach, token files, icons, image handling, tests, stories, and existing agent rule files.
2. Call `create_design_system_rules` when the active MCP server exposes it, passing languages and frameworks that match the repository.
3. Generate rules for the active agent target. Prefer an existing repo convention over this table, and prefer adding a focused Figma section over rewriting broad root instructions:

| Agent | Rule file |
|---|---|
| Codex | `AGENTS.md` or a project-local `AGENTS.md` in the affected package |
| Claude Code | `CLAUDE.md` or a project-local `CLAUDE.md` in the affected package |
| Cursor | `.cursor/rules/figma-design-system.mdc` |
| Windsurf | `.windsurfrules` |
| Cline | `.clinerules` |
| Roo Code | `.roo/rules/figma-design-system.md` or `.roo/rules-code/figma-design-system.md` |
| Continue | `.continue/rules/figma-design-system.md` |
| Generic agents | project-local `AGENTS.md`, `.agents/rules/figma-design-system.md`, or the repository's documented agent-rule path |

4. Include project-specific guidance for:
   - Component locations and naming
   - Layout primitives and composition patterns
   - Token and theme usage
   - Asset handling and icon policy
   - Figma MCP retrieval flow
   - Visual verification expectations
   - Known anti-patterns for this repository
5. Keep rules concise enough to be read on every relevant task. Move long examples into project docs only if the repo already has that pattern.
6. Do not overwrite existing broad agent rules. Add a focused Figma section or project rule file that preserves unrelated instructions.

### Code Connect

Request: "Code Connect this component" or "map this Figma component to our Button."

1. Confirm the task is Code Connect, not ordinary code implementation.
2. Check whether the host provides the **`figma-code-connect`** skill or another native Code Connect workflow. If so, use this skill to plan and validate mappings, then use `figma-code-connect` or the native workflow for template authoring and submission when the user approves.
3. Confirm the Figma target is a component, component set, or instance of a published library component. Code Connect mapping is not for arbitrary frames.
4. Confirm plan and access:
   - Call `whoami` when available. Code Connect requires a Figma **Organization or Enterprise** plan; stop with a clear blocker on Free or Professional.
   - Figma MCP server is connected.
   - Code Connect tools are available, or the host's native Code Connect workflow is available.
   - The user can access the Figma library and the code repository.
   - Figma UI-based mapping has the GitHub repository/path connected for mapping context when required.
   - **MCP templates:** create or update `.figma.ts` files via the **`figma-code-connect`** skill (not `.figma.tsx`).
   - **CLI/parser:** the project uses `figma.connect()` in `.figma.tsx` files and has a Figma token that can read the target file and write Code Connect metadata.
5. Confirm the code side is map-ready:
   - Component has a stable import path.
   - Props and variants are part of the public API.
   - Required icons, slots, or children have real code representations.
   - Example usage or stories exist, or the component source is clear enough to map.
6. Use the active MCP server's suggestion tool when available, such as `get_code_connect_suggestions`, to list unmapped components and properties.
7. Inspect the repository for the real code component, exports, props, variants, and usage examples.
8. Map Figma properties to actual code APIs:
   - Variant names to component variant props
   - Boolean layer states to boolean props
   - Size modes to size props
   - Icons or slots to real children/slot APIs
9. Mark unsupported Figma properties as intentionally unmapped instead of inventing props.
10. Submit mappings only when the user asked to write/apply them and the MCP server exposes a mapping tool such as `send_code_connect_mappings`.
11. Verify mappings with a readback or suggestion tool when available.

## MCP Failure Playbook

See [troubleshooting.md](troubleshooting.md) for the full recovery steps organized by failure type: Server Not Available, Tool Missing, and Access/Rate Limit/Server Error.

## Out of Scope

This skill is for Figma-to-repository work. The following workflows are out of scope unless explicitly requested:

- Creating or editing Figma Design files
- Creating or editing FigJam boards
- Generating diagrams
- Generating slides or presentation decks
- Uploading assets into Figma
- Broad Figma library maintenance unrelated to the target implementation

When one of these workflows is requested, follow the active Figma MCP tool schema and user approval boundaries before writing to Figma.

## Peer benchmarks

See [benchmarks.md](benchmarks.md) for skills.sh listings, install counts, and a comparison matrix against `figma-implement-design`, OpenAI curated skills, Stitch, and community alternatives.
