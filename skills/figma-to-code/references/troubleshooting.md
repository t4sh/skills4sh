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
