# Portless captures

Use the existing Portless installation and project workflow. This reference covers loopback captures through named `.localhost` routes with either browser tooling or the bundled Playwright helpers.

## Select and verify the route

1. Prefer the user's supplied URL. Otherwise inspect the project's dev script and `portless.json`, then match a registered route from `portless list` to the requested app **and worktree**. `portless get <base-name>` adds the current worktree prefix and can print an unregistered URL; pass the base name only. If `get` and `list` disagree, use a listed route only with evidence that it serves the requested app and worktree. A main-worktree route is not a fallback for a stopped feature worktree. If no matching route can be established, report it unavailable or ask for the intended URL; do not navigate a substitute. `portless run` adds a worktree prefix; an explicit `portless <name> <cmd>` does not. Check `portless --help` when the installed version differs. If several routes fit, ask which to capture.
2. Copy the listed scheme, hostname, and port exactly. Never substitute the upstream app port or guess `localhost:3000`: host-based routing, cookies, and redirects depend on the origin. Current Portless defaults to `https://<name>.localhost` on port 443, with no port in the URL. An older proxy may still print `http://<name>.localhost:1355`. Both are valid when they are the listed URL.
3. Open that exact URL from the host browser or host-accessible Playwright process. Check the response, final main-frame URL, and expected app content. Wait for the requested page's readiness selector. Reject a proxy error page or missing route as a failed preflight.
4. Pass the verified URL as the first argument to `quick.js`, `multi-breakpoint.js`, or `screenshot-a11y.js`; the remaining arguments and output formats are unchanged. Preserve paths and query strings when selecting a route. Use only the requested viewports.

Read-only discovery commands and worktree name handling are documented in [Portless commands](https://portless.sh/commands). Documentation checked 2026-09-27; use the installed version's help when behavior differs.

## HTTPS and failures

Use normal certificate validation. Portless can generate and trust a local CA; see [HTTPS setup](https://portless.sh/https). If the capture browser rejects it, report the trust error and check `portless doctor`. OS trust and a separate browser profile may differ. The bundled helpers do not disable certificate checks, and a Portless route must not set `ignoreHTTPSErrors`. The self-signed snippet in [playwright-patterns.md](playwright-patterns.md) is for a local server this skill starts itself; it does not apply here. Do not downgrade the route to HTTP or bypass a browser warning. `portless trust` is the user's one-time CA install; do not run it, `portless clean`, or `portless hosts sync` during capture.

| Observation | Next step |
|---|---|
| Route listed, connection refused | Check proxy and upstream liveness with `portless doctor`; reuse the project's documented start command when starting is authorized |
| Proxy responds but app is missing or returns an error | Verify route name and upstream readiness; do not save the error page as a successful app capture |
| Name fails in shell but works in the host browser | Use the host browser; a shell resolver or isolated sandbox may differ |
| Stale route or conflicting name | Report the conflict; do not take over another process with `--force` |

Keep existing proxy configuration, trust stores, hosts files, and services intact during capture. Discovery is `portless list`, `portless get`, and `portless doctor` only. Do not run bare `portless`, `portless run`, `portless proxy start`, `portless trust`, `portless clean`, or `portless prune` to find a route: those commands can launch apps, change trust, or stop processes. Stop only servers or browser resources created for the capture task.

## Local network boundary

A single trailing DNS root dot is accepted, including `http://myapp.localhost.`. Remove that dot only when classifying the parsed hostname; preserve the requested URL for navigation. Apply the same local-host check to main-frame redirects and the final URL.

The helpers accept HTTP/HTTPS `localhost`, `127.0.0.1`, `[::1]`, and names ending in `.localhost`, including nested worktree names. The existing main-frame redirect and final-URL checks still apply; external subresources remain permitted.

Custom TLDs such as `.test`, LAN `.local`, Tailscale, and public tunnel URLs are outside this skill's current localhost policy. A Portless route listing does not make an arbitrary hostname local. Use an already-configured `.localhost` route when available; otherwise report the unsupported target instead of broadening the allowlist or silently changing its origin.
