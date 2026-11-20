# Security checklist — audit kit

Canonical XSS, CSP, passthrough, and secrets audit for Eleventy + Nunjucks sites. Use as a pre-deploy gate, PR review attachment, or quarterly hardening pass. Pair with `review-shipping.md` for build and template stability checks.

## How to use this file

1. Pick the sections by scope; each section repeats its scope under the heading.

   | Scope | Sections | Walk when |
   |---|---|---|
   | Any Eleventy or Nunjucks template | §1, §4 | Reviewing one template or a template-only PR: walk these two and stop |
   | Any Eleventy site, at deploy time | §2, §3, §6, §7, §10 | Before a production deploy; these need the built output, the live responses, or the pipeline |
   | Example deployment profile and operations | §5, §8, §9, §11, §12, and the nginx commands in §2 | Only when the user asks for that deployment or operations review, or the project already uses the pattern |

2. For each box: either tick it or write a one-line waiver explaining why it doesn't apply
3. Inspect the project's Eleventy config, build command, and CLI overrides to identify its actual input and output directories. Replace the example `src/` and `out/` paths in the shell searches before running them, and point the config searches at the file the project actually resolves (a v4 project may use `buildawesome.config.*`). They are triage hints: multiline templates and custom code can evade them. Verify rendered output and HTTP responses too.

---

## 1. Output escaping (XSS)

**Scope:** any Eleventy or Nunjucks template.

- [ ] **Autoescape is on.** Eleventy + Nunjucks default this. Confirm `setNunjucksEnvironmentOptions` (if used) doesn't disable it, and that no custom environment replaces it: an environment passed to `setLibrary("njk", env)` overrides `setNunjucksEnvironmentOptions`, so its own `autoescape` option decides.
  ```bash
  grep -nE "autoescape|setLibrary\([\"']njk|nunjucks\.configure|Environment\(" .eleventy.js eleventy.config.* 2>/dev/null
  # Expected: no matches, OR explicit `autoescape: true` on every environment the config creates
  ```

- [ ] **Templates outside Nunjucks are escaped by hand.** Autoescape is a Nunjucks feature. Liquid output is not escaped: `{{ value }}` in a `.liquid` file, or in `.md` / `.html` when `markdownTemplateEngine` / `htmlTemplateEngine` are left at their `liquid` default, is written raw and needs `| escape`.
  ```bash
  grep -nE "markdownTemplateEngine|htmlTemplateEngine" .eleventy.js eleventy.config.* 2>/dev/null
  find src -name '*.liquid'
  # No engine setting means .md and .html are preprocessed by Liquid
  ```

- [ ] **Every `| safe` is documented or justified.**
  ```bash
  # List every | safe use — review each line
  grep -rnE "\|\s*safe\b" src/
  ```
  Acceptable: trusted authored HTML, content rendered by `md` filter with `html: false`, output of `jsonScript`/`jsonCompact` inside `<script>`.
  Unacceptable: anything from `_data/*.json` that originates from a CMS, form, or external feed.

- [ ] **Shortcodes escape their arguments.** Eleventy marks shortcode return values as safe HTML, so autoescape never sees them. Read each registered shortcode; every argument interpolated into markup must be escaped or allow-listed inside the function (see `filters.md` § Shortcodes vs filters).
  ```bash
  grep -nE "add[A-Za-z]*Shortcode\(" .eleventy.js eleventy.config.* 2>/dev/null
  # Review each implementation; not a blocking gate
  ```

- [ ] **No unquoted attribute values contain template output.** `<div class={{ kind }}>` lets a space in the value start a new attribute such as an event handler; autoescape does not prevent it.
  ```bash
  grep -rnE "[[:alnum:]_-]=[^\"'[:space:]>{]*[{][{%]" src/
  # Expected: zero results. Also matches `?key={{ value }}` inside a quoted URL; review those as URL attributes
  ```

- [ ] **URL attributes carry only vetted schemes.** Autoescape leaves a `javascript:` URL intact. For each attribute whose value starts with template output, confirm the data is authored, or validate the scheme (`https:`, `mailto:`, a root-relative path) where the data is produced.
  ```bash
  grep -rnE "(href|src|srcset|action|formaction)=[\"'][[:space:]]*[{][{]" src/
  # Review each result; not a blocking gate
  ```

- [ ] **No template output inside inline event handlers.** The browser decodes HTML entities in an `on…=""` attribute before running it as JavaScript, so an escaped quote still closes a string. Pass data through `data-*` attributes or a `jsonScript` block instead.
  ```bash
  grep -rnE "[[:space:]]on[a-z]+=(\"[^\"]*[{][{]|'[^']*[{][{])" src/
  # Expected: zero results
  ```

- [ ] **No `dump | safe` anywhere.**
  ```bash
  grep -rnE "\|\s*dump\s*\|\s*safe" src/
  # Expected: zero results
  ```

- [ ] **No `| safe` expression inside `<script>` unless it is `jsonScript | safe` or `jsonCompact | safe`.** Covers any `<script …>` opening tag, including `type="module"` and `type="application/ld+json"`.
  ```bash
  grep -rnE '<script[^>]*>.*[{][{][^}]*[|][[:space:]]*safe([^[:alnum:]_]|$)' src/ \
    | grep -vE '[|][[:space:]]*json(Script|Compact)[[:space:]]*[|][[:space:]]*safe'
  # Expected: zero results
  ```

- [ ] **Informational: review unfiltered `{{ var }}` inside `<script>`.** Autoescaping makes these HTML-safe, not JavaScript-safe; prefer `jsonScript`/`jsonCompact` for data.
  ```bash
  grep -rnE '<script[^>]*>.*[{][{][^|}]*[}][}]' src/
  # Review each result; not a blocking gate
  ```

  Both searches are line-based. A `{{ … }}` on a later line than `<script>` evades them, and a line that mixes an allowed JSON filter with another `| safe` is dropped by the exclusion; inspect multi-line scripts and rendered output.

- [ ] **Markdown engine `html` is `false` for any source that's not 100% trusted authored content.**
  ```bash
  grep -nE "markdownIt\(\{[^}]*html:\s*true" .eleventy.js eleventy.config.*
  # If true: document why in the project's AGENTS.md
  ```

- [ ] **Template source is trusted.** `markdownTemplateEngine: "njk"` executes templates before Markdown rendering; `html: false` is not a template sandbox. Render external Markdown as data, and do not allow it to define executable templates, filters, config, or arbitrary frontmatter.
- [ ] **Custom escaping extensions are reviewed.** Stock Nunjucks 3 has no `{% autoescape %}` block tag; do not copy Jinja-only syntax into templates.

---

## 2. HTTP headers (CSP, X-Frame, HSTS)

**Scope:** any Eleventy site, at deploy time. The nginx commands belong to the example deployment profile; use the project's own server or host configuration.

- [ ] **Development CSP is compatible with live reload.** Prefer response headers in production. If the project uses a meta policy, omit it during `serve` or explicitly permit the live-reload script and WebSocket endpoints.
  ```bash
  grep -nE "Content-Security-Policy" src/_includes/layouts/*.njk
  # Review the build/serve condition and the actual development endpoints.
  ```

- [ ] **`frame-ancestors` is delivered as an HTTP header, not via `<meta>`.**
  ```bash
  # In <meta> — silently ignored per CSP3, security theater
  grep -rnE 'Content-Security-Policy[^"]*frame-ancestors' src/
  # Expected: zero results
  
  # In nginx — required
  grep -E "frame-ancestors" /etc/nginx/conf.d/*.conf
  # Expected: present and `always` flag set
  ```

- [ ] **`X-Frame-Options: DENY` as legacy fallback.**
  ```bash
  curl -sI https://example.com/ | grep -i x-frame-options
  # Expected: X-Frame-Options: DENY
  ```

- [ ] **`script-src` is `'self'` (or stricter).** No `'unsafe-inline'` for scripts.
  ```bash
  curl -sI https://example.com/ | grep -i content-security-policy
  # script-src should not contain 'unsafe-inline'
  ```

- [ ] **`style-src 'unsafe-inline'` is documented if present.** Tailwind’s generated stylesheet does not require it by itself; retain it only for an identified inline-style path.

- [ ] **`connect-src` matches actual XHR/fetch destinations.** No `*` wildcards in production.

- [ ] **HSTS is set with reasonable max-age.**
  ```bash
  curl -sI https://example.com/ | grep -i strict-transport-security
  # Expected: max-age=31536000 (1 year) or longer
  ```

- [ ] **nginx locations retain security headers.** A location with its own `add_header` suppresses inherited server headers by default; use the shared include from `production-patterns.md` in every affected location. Verify pages, assets, redirects, and errors.

- [ ] **All security headers use `always` flag in nginx** (otherwise they're skipped on error responses).
  ```bash
  grep -E "add_header.*Content-Security|add_header.*X-Frame|add_header.*Strict-Transport" /etc/nginx/conf.d/*.conf | grep -v "always"
  # Expected: zero results (every header has `always`)
  ```

- [ ] **Full header verification:**
  ```bash
  curl -sI https://example.com/ | grep -iE 'content-security-policy|x-frame-options|strict-transport-security|x-content-type-options|referrer-policy|permissions-policy'
  ```

---

## 3. Passthrough copy — supply-chain hygiene

**Scope:** any Eleventy site, at deploy time.

- [ ] **All `addPassthroughCopy` calls use `{src: dest}` mapping**, not broad globs.
  ```bash
  grep -nE 'addPassthroughCopy\("[^"]+\*' .eleventy.js eleventy.config.*
  # Expected: zero results (no glob patterns)
  ```

- [ ] **No `node_modules/`, `.env*`, `*.key`, `*.pem`, `id_rsa*`, `.git/` could be copied.**
  ```bash
  # Walk the build output for secret-shaped files
  find out -name '.env*' -o -name '*.key' -o -name '*.pem' -o -name 'id_rsa*' -o -name '.git'
  # Expected: zero results
  ```

- [ ] **`out/` does not contain SSH keys, credentials, or service-account JSONs.**
  ```bash
  grep -rE 'BEGIN (RSA|EC|OPENSSH|PGP) PRIVATE KEY' out/ 2>/dev/null
  grep -rE 'AKIA[0-9A-Z]{16}|sk-[a-zA-Z0-9]{32,}' out/ 2>/dev/null
  # Expected: zero results
  ```

- [ ] **Source-map policy matches the build.** Minification is not a general guarantee that maps are disabled. Inspect output and document intentional public maps.
  ```bash
  find out -name '*.map'
  # Expected: zero results (or document each one)
  ```

---

## 4. Inline script safety

**Scope:** any Eleventy or Nunjucks template.

- [ ] **No raw `{{ x | dump | safe }}` inside `<script>` tags.**
  ```bash
  grep -rnE "<script>[^<]*\|\s*dump\s*\|\s*safe" src/
  # Expected: zero results
  ```

- [ ] **Every inline `<script>window.X = {{ ... }}</script>` uses `jsonScript` / `jsonCompact`.**
  ```bash
  # Find inline window assignments
  grep -rnE 'window\.\w+\s*=\s*{{' src/ | grep -v -E 'jsonScript|jsonCompact'
  # Expected: zero results
  ```

- [ ] **The escape filter handles U+2028 and U+2029.**
  ```bash
  grep -A5 "addFilter.*jsonScript" .eleventy.js eleventy.config.* | grep -E 'u2028|u2029'
  # Expected: both present in the filter source
  ```

---

## 5. Custom soft-navigation / DOM swap

> **Example deployment profile.** This section describes one project's deployment setup, not Eleventy or Nunjucks guidance. Load it only when the user asks for this kind of deployment work or the project already uses this pattern.

- [ ] **HTML swapped into the DOM by a custom router is sanitized with DOMPurify** (or equivalent).
  ```bash
  grep -rnE 'innerHTML\s*=' src/assets/js/ | grep -v -E 'DOMPurify|sanitize'
  # Expected: zero results (every innerHTML write is preceded by sanitization)
  ```

- [ ] **Sanitizer config is not widened beyond the project's CSS policy.** Preserving `<style>` tags is only for trusted authored pages with an explicit CSS policy; do not add `ADD_TAGS: ['style']` for arbitrary remote HTML.
  ```bash
  grep -A3 'DOMPurify\.sanitize' src/assets/js/ | grep "ADD_TAGS"
  # Each match: confirm the source is trusted authored HTML, not remote content
  ```

- [ ] **Soft-nav targets are validated.** No `<a href="javascript:…">` or `<a href="data:…">` survives sanitization.

---

## 6. Build environment + secrets

**Scope:** any Eleventy site, at deploy time.

- [ ] **Build env vars used in `_data/*.js` are non-secret** (e.g. `COMMIT_SHA`, `BUILT_AT`).
  ```bash
  grep -E "process\.env\." src/_data/*.js src/_data/*.cjs 2>/dev/null
  # Each match: confirm the var is non-secret
  ```

- [ ] **No API keys, tokens, or credentials baked into output HTML/JS.**
  ```bash
  grep -rE 'api[_-]?key|token|secret|password|bearer' out/ 2>/dev/null | head -20
  # Each match: confirm it's a UI label, not a real credential
  ```

- [ ] **CI secrets injected via env, never committed.**
  ```bash
  # Look for hardcoded credentials in workflow files
  grep -rE '(api[_-]?key|token|secret|password)\s*[:=]\s*["\047][a-zA-Z0-9]{16,}' .github/workflows/
  # Expected: zero results
  ```

---

## 7. Asset integrity

**Scope:** any Eleventy site, at deploy time.

- [ ] **All external scripts have `crossorigin` + `integrity` (SRI) attributes**, or are first-party.
  ```bash
  grep -rnE '<script[^>]+src="https?://[^"]+"' src/ | grep -v -E 'integrity=|crossorigin='
  # Each match: either move to first-party or add SRI
  ```

- [ ] **No CDN fetches from unstable origins** in production HTML.
  ```bash
  grep -rE '<script[^>]+src="https?://[^"]+"' src/ | grep -E 'unpkg|jsdelivr|cdnjs|polyfill\.io'
  # Each match: pin to a specific version, OR move to first-party
  ```

- [ ] **Fonts loaded with `font-display: swap` and `preconnect`.**
  ```nunjucks
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter+Tight&display=swap" />
  ```

---

## 8. Robots, SEO, and visibility

**Scope:** operations only; walk on request.

- [ ] **`X-Robots-Tag: none` removed from nginx config before public launch.**
  ```bash
  curl -sI https://example.com/ | grep -i x-robots-tag
  # Expected: no x-robots-tag header (or `index, follow`)
  ```

- [ ] **`robots.txt` allows crawling intended paths and disallows preview/staging.**
  ```bash
  curl -s https://example.com/robots.txt
  ```

- [ ] **`sitemap.xml` paths match canonical URLs.**
  ```bash
  curl -s https://example.com/sitemap.xml | grep -oE '<loc>[^<]+</loc>' | head -10
  # Each path should be exactly what's in <link rel="canonical">
  ```

- [ ] **Preview/staging subdomains are noindex.**
  ```bash
  curl -sI https://preview.example.com/ | grep -i x-robots-tag
  # Expected: noindex
  ```

---

## 9. Form security

**Scope:** operations only; walk on request.

If the site has any forms (contact, signup, search):

- [ ] **`form-action` in CSP matches actual targets.**
- [ ] **Forms use `method="POST"` for state-changing actions**, never `GET`.
- [ ] **CSRF protection** in place if forms submit to a same-project backend (token in form, validated server-side).
- [ ] **`autocomplete` attributes** set appropriately (`one-time-code`, `current-password`, `new-password`).
- [ ] **`<input type="email">` / `type="tel">`** for typed inputs — surfaces appropriate keyboards on mobile.
- [ ] **No client-side validation as the only check** — server-side validates everything.

---

## 10. Build pipeline integrity

**Scope:** any Eleventy site, at deploy time.

- [ ] **CI uses the repository’s lockfile-preserving install command** (`pnpm install --frozen-lockfile`, `npm ci`, or the project-manager equivalent).
- [ ] **`packageManager` field in `package.json` is pinned to an exact version.**
- [ ] **Dependabot or equivalent is enabled.**
- [ ] **Security advisories for critical dependencies (`@11ty/eleventy`, `markdown-it`, `tailwindcss`) are triaged and patched within the project’s documented severity-based SLA.**
- [ ] **No `*` or `latest` version specifiers in `package.json`.**
  ```bash
  grep -nE '"\^?[*]"|"\^?latest"' package.json
  # Expected: zero results
  ```

---

## 11. Tooling integration

**Scope:** operations only; walk on request.

- [ ] **If the project vendors agent skills, its skill guard scan rates them SAFE or WARNING-with-justification.** Skip when the project has no such scanner.
  ```bash
  npm run check:guardskills   # only where the project defines this script; otherwise run its configured guard scanner
  ```

- [ ] **Snyk / `npm audit` shows no high or critical CVEs.**
  ```bash
  pnpm audit --audit-level high   # npm: npm audit --audit-level=high
  # Or: snyk test --severity-threshold=high
  ```

- [ ] **CodeQL (or equivalent SAST) runs on every PR.**

- [ ] **Renovate / Dependabot PRs are reviewed promptly** — stale security PRs are themselves a security issue.

---

## 12. Operational

**Scope:** operations only; walk on request.

- [ ] **Cloudflare (or CDN) WAF rules enabled for the production zone.**
- [ ] **Rate limits on form submissions** (nginx `limit_req_zone`, or Cloudflare rules).
- [ ] **Monitoring alerts on 5xx spikes**, CSP report-uri (if used), and certificate expiry.
- [ ] **TLS certificate auto-renewal verified** (LetsEncrypt cron, Cloudflare, etc.).
- [ ] **DNS records use DNSSEC** if available.

---

## Quick audit script

```bash
#!/usr/bin/env bash
# scripts/security-audit.sh — run before deploy
set -euo pipefail

if [ "$#" -ne 3 ]; then
  echo "Usage: $0 https://example.com INPUT_DIR OUTPUT_DIR" >&2
  echo "Inspect Eleventy config and build/CLI overrides; pass the directories used by this build." >&2
  exit 64
fi

target_url="$1"
input_dir="$2"
output_dir="$3"

for required_dir in "$input_dir" "$output_dir"; do
  if [ ! -d "$required_dir" ]; then
    echo "Missing directory: $required_dir (check Eleventy config, build/CLI overrides, and build completion)" >&2
    exit 1
  fi
done

echo "→ Checking | safe usage…"
safe_count=$(grep -rnE "\|[[:space:]]*safe([[:space:]|}]|$)" "$input_dir" 2>/dev/null | wc -l | tr -d ' ' || true)
echo "  ${safe_count} occurrence(s); review each trust boundary"

echo "→ Checking dump | safe (must be zero)…"
if grep -rnE "\|[[:space:]]*dump[[:space:]]*\|[[:space:]]*safe([[:space:]|}]|$)" "$input_dir"; then
  exit 1
else
  echo "  ok"
fi

echo "→ Checking | safe inside <script> (must be zero)…"
if grep -rnE '<script[^>]*>.*[{][{][^}]*[|][[:space:]]*safe([^[:alnum:]_]|$)' "$input_dir" \
  | grep -vE '[|][[:space:]]*json(Script|Compact)[[:space:]]*[|][[:space:]]*safe'; then
  exit 1
else
  echo "  ok"
fi

echo "→ Unfiltered {{ }} inside <script> (informational)…"
grep -rnE '<script[^>]*>.*[{][{][^|}]*[}][}]' "$input_dir" || echo "  none"

echo "→ Checking output for secret-shaped files (must be zero)…"
if find "$output_dir" \( -name '.env*' -o -name '*.key' -o -name '*.pem' -o -name 'id_rsa*' \) -print -quit | grep -q .; then
  exit 1
else
  echo "  ok"
fi

echo "→ Checking output for inline credentials…"
if grep -rE 'BEGIN (RSA|EC|OPENSSH|PGP) PRIVATE KEY|AKIA[0-9A-Z]{16}|sk-[a-zA-Z0-9]{32,}' "$output_dir"; then
  exit 1
else
  echo "  ok"
fi

echo "→ Production headers…"
headers=$(curl --fail --silent --show-error --head "$target_url")
for header in content-security-policy x-frame-options strict-transport-security; do
  if ! grep -qi "^${header}:" <<<"$headers"; then
    echo "Missing required header: ${header}" >&2
    exit 1
  fi
done

echo "✓ Audit complete"
```

After a completed build, run with the input and output directories confirmed from that project's config and build command, for example: `bash scripts/security-audit.sh https://example.com content _site`.
