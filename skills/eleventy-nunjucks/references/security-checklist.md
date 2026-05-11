# Security checklist — audit kit

Canonical XSS, CSP, passthrough, and secrets audit for Eleventy + Nunjucks sites. Use as a pre-deploy gate, PR review attachment, or quarterly hardening pass. Pair with `review-shipping.md` for build and template stability checks.

## How to use this file

1. Walk every section in order before a production deploy
2. For each box: either tick it or write a one-line waiver explaining why it doesn't apply
3. The `grep` / `curl` commands are copy-paste-ready — run them against the project root

---

## 1. Output escaping (XSS)

- [ ] **Autoescape is on.** Eleventy + Nunjucks default this. Confirm `setNunjucksEnvironmentOptions` (if used) doesn't disable it.
  ```bash
  grep -nE "autoescape" .eleventy.js eleventy.config.* 2>/dev/null
  # Expected: no matches, OR explicit `autoescape: true`
  ```

- [ ] **Every `| safe` is documented or justified.**
  ```bash
  # List every | safe use — review each line
  grep -rnE "\|\s*safe\b" src/
  ```
  Acceptable: trusted authored HTML, content rendered by `md` filter with `html: false`, output of `jsonScript`/`jsonCompact` inside `<script>`.
  Unacceptable: anything from `_data/*.json` that originates from a CMS, form, or external feed.

- [ ] **No `dump | safe` anywhere.**
  ```bash
  grep -rnE "\|\s*dump\s*\|\s*safe" src/
  # Expected: zero results
  ```

- [ ] **No raw `{{ var }}` inside `<script>` blocks.** Must use an escape filter.
  ```bash
  grep -rnE "<script>[^<]*{{[^|]+}}[^<]*</script>" src/ | grep -v -E "jsonScript|jsonCompact"
  ```

- [ ] **Markdown engine `html` is `false` for any source that's not 100% trusted authored content.**
  ```bash
  grep -nE "markdownIt\(\{[^}]*html:\s*true" .eleventy.js eleventy.config.*
  # If true: document why in the project's AGENTS.md
  ```

- [ ] **`{% autoescape false %}` blocks are reviewed line-by-line.**
  ```bash
  grep -rnE "{%\s*autoescape\s+false\s*%}" src/
  # Each block: confirm the content inside is sanitized upstream
  ```

---

## 2. HTTP headers (CSP, X-Frame, HSTS)

- [ ] **CSP `<meta>` emitted on build only, not on dev serve.**
  ```bash
  grep -nE "Content-Security-Policy" src/_includes/layouts/*.njk
  # Should be wrapped in {% if eleventy.env.runMode == "build" %}
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

- [ ] **`style-src 'unsafe-inline'` is documented if present.** Tailwind v4 may need it for some patterns; if not, drop it.

- [ ] **`connect-src` matches actual XHR/fetch destinations.** No `*` wildcards in production.

- [ ] **HSTS is set with reasonable max-age.**
  ```bash
  curl -sI https://example.com/ | grep -i strict-transport-security
  # Expected: max-age=31536000 (1 year) or longer
  ```

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
  grep -rE 'AKIA[0-9A-Z]{16}|sk-[a-zA-Z0-9]{32,}|ctx7sk-[a-f0-9]+' out/ 2>/dev/null
  # Expected: zero results
  ```

- [ ] **Source maps not shipped to production.** (`tailwindcss --minify` disables them; verify.)
  ```bash
  find out -name '*.map'
  # Expected: zero results (or document each one)
  ```

---

## 4. Inline script safety

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

## 5. View Transitions / DOM swap

- [ ] **HTML swapped via View Transitions is sanitized with DOMPurify** (or equivalent).
  ```bash
  grep -rnE 'innerHTML\s*=' src/assets/js/ | grep -v -E 'DOMPurify|sanitize'
  # Expected: zero results (every innerHTML write is preceded by sanitization)
  ```

- [ ] **`ADD_TAGS: ['style']` is set in DOMPurify config if per-page `<style>` blocks are needed.**
  ```bash
  grep -A3 'DOMPurify\.sanitize' src/assets/js/ | grep "ADD_TAGS"
  ```

- [ ] **Soft-nav targets are validated.** No `<a href="javascript:…">` or `<a href="data:…">` survives sanitization.

---

## 6. Build environment + secrets

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

If the site has any forms (contact, signup, search):

- [ ] **`form-action` in CSP matches actual targets.**
- [ ] **Forms use `method="POST"` for state-changing actions**, never `GET`.
- [ ] **CSRF protection** in place if forms submit to a same-project backend (token in form, validated server-side).
- [ ] **`autocomplete` attributes** set appropriately (`one-time-code`, `current-password`, `new-password`).
- [ ] **`<input type="email">` / `type="tel">`** for typed inputs — surfaces appropriate keyboards on mobile.
- [ ] **No client-side validation as the only check** — server-side validates everything.

---

## 10. Build pipeline integrity

- [ ] **CI uses `pnpm install --frozen-lockfile`** (or equivalent), not `npm install`.
- [ ] **`packageManager` field in `package.json` is pinned to an exact version.**
- [ ] **Dependabot or equivalent is enabled.**
- [ ] **Critical dependencies (`@11ty/eleventy`, `markdown-it`, `tailwindcss`) get security patches within a week.**
- [ ] **No `*` or `latest` version specifiers in `package.json`.**
  ```bash
  grep -nE '"\^?[*]"|"\^?latest"' package.json
  # Expected: zero results
  ```

---

## 11. Tooling integration

- [ ] **`guardskills` scan rates SAFE or WARNING-with-justification.**
  ```bash
  npx guardskills add . --skill <your-skill> --dry-run
  ```

- [ ] **Snyk / `npm audit` shows no high or critical CVEs.**
  ```bash
  pnpm audit --severity high
  # Or: snyk test --severity-threshold=high
  ```

- [ ] **CodeQL (or equivalent SAST) runs on every PR.**

- [ ] **Renovate / Dependabot PRs are reviewed promptly** — stale security PRs are themselves a security issue.

---

## 12. Operational

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
set -e
echo "→ Checking | safe usage…"
grep -rnE "\|\s*safe\b" src/ | wc -l

echo "→ Checking dump | safe (must be zero)…"
grep -rnE "\|\s*dump\s*\|\s*safe" src/ && exit 1 || echo "  ok"

echo "→ Checking inline scripts without escape filter (must be zero)…"
grep -rnE "<script>[^<]*{{[^|]+}}[^<]*</script>" src/ \
  | grep -v -E "jsonScript|jsonCompact" && exit 1 || echo "  ok"

echo "→ Checking output for secret-shaped files (must be zero)…"
find out -name '.env*' -o -name '*.key' -o -name '*.pem' -o -name 'id_rsa*' && exit 1 || echo "  ok"

echo "→ Checking output for inline credentials…"
grep -rE 'BEGIN (RSA|EC|OPENSSH|PGP) PRIVATE KEY|AKIA[0-9A-Z]{16}|sk-[a-zA-Z0-9]{32,}' out/ && exit 1 || echo "  ok"

echo "→ Production headers…"
curl -sI "$1" | grep -iE 'content-security-policy|x-frame-options|strict-transport-security'

echo "✓ Audit complete"
```

Run as: `bash scripts/security-audit.sh https://example.com`
