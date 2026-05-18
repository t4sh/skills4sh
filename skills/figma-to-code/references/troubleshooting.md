# Figma MCP Troubleshooting

Use these recovery steps when MCP tools are unavailable, missing, or failing. Prefer the active MCP server's schema over any example parameter name here.

## Server Not Available

1. Confirm whether the task expects desktop MCP or remote MCP.
2. For desktop MCP, ask the user to open Figma Desktop, select the target node, and reconnect the MCP server.
3. For remote MCP, use `whoami` or the server's identity tool when available. On Cursor, call **`mcp_auth`** for `plugin-figma-figma` when auth fails, then retry once. Ask the user to authenticate or provide a URL the authenticated account can access if access still fails.
4. Continue with screenshots or exports only if the user accepts reduced fidelity.

## Tool Missing

1. List the missing tool and the closest available alternatives.
2. Use `get_metadata` plus `get_design_context` as the fallback for most implementation tasks.
3. Use `get_variable_defs` or design-system search for token tasks.
4. Treat Code Connect submission as blocked if mapping tools are unavailable.

## Access, Rate Limit, or Server Error

1. Retry once for transient server failures.
2. Reduce scope to a smaller frame or selected child node.
3. For auth or permissions errors, try `mcp_auth` on Cursor's Figma plugin server when applicable, then stop and ask for sign-in, file permission, plan upgrade (Code Connect), or a different Figma URL.
4. For rate limits, stop after one narrowed retry and report that the Figma MCP server is rate-limiting the workflow.

## Truncated Context

1. Keep or refresh the full screenshot as the visual source of truth.
2. Call `get_metadata` on the parent frame.
3. Choose the smallest useful child nodes for each region or component.
4. Call `get_design_context` for each chosen child.
5. Compare the final assembly against the full screenshot, not only against child contexts.

If child context still truncates, repeat metadata narrowing one level deeper. Avoid implementing from partial data without naming the uncertainty.

## Missing Screenshot

Do not implement from generated code alone when a screenshot tool is available.

1. Retry the screenshot for the same node.
2. Retry a parent frame if the selected child fails.
3. Retry a smaller child node if the parent is too large.
4. If retries fail, ask whether to proceed with reduced fidelity.

When proceeding without a screenshot, state that pixel/visual parity was not fully verifiable.

## Missing Assets

1. Inspect design context for image, SVG, and asset endpoint references.
2. Prefer MCP-provided URLs, including localhost asset sources.
3. Use the repository's normal asset pipeline for persistent files.
4. If assets are unavailable, ask for the missing file or document the exact blocked layer.

Do not invent grey boxes, approximate SVGs, or new icon packages when the Figma payload already indicates a real asset.

## Reduced-Fidelity Fallbacks

Continue without full MCP fidelity only when the user accepts it or the task is explicitly exploratory. In the completion summary, include:

- Which MCP capability was unavailable.
- Which source was used instead: screenshot, export, static spec, or user description.
- What could not be verified.
- What follow-up would restore full fidelity.
