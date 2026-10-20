# Code Examples — Full Reference

## URL and Filename Sanitization (CRITICAL)

**Before downloading, sanitize ALL filenames and validate ALL URLs.** Discord content is untrusted input.

### Filename Sanitization

Strip path traversal and shell-unsafe characters:

```bash
sanitize_filename() {
  local name="$1"
  name="${name//\\//}"                 # normalize Windows path separators
  name=$(basename -- "$name")           # strip any path components (../../)
  name="${name//[^a-zA-Z0-9._-]/_}"     # allow only safe characters
  while [[ "$name" == .* ]]; do name="${name#.}"; done  # strip all leading dots (hidden files)
  name="${name:0:200}"                   # truncate to 200 chars max
  while [[ "$name" == *. ]]; do name="${name%.}"; done  # Windows forbids trailing dots
  if [ -z "$name" ] || [ "$name" = "." ]; then
    name="unnamed"
  fi

  local stem="${name%%.*}"
  local lower
  lower=$(printf '%s' "$stem" | tr '[:upper:]' '[:lower:]')
  if [[ "$lower" =~ ^(con|prn|aux|nul|com[1-9]|lpt[1-9])$ ]]; then
    name="_${name}"                       # avoid Windows reserved device names
  fi
  echo "$name"
}
```

### URL Validation

Only allow exact Discord CDN domains for the initial request, block private/internal IPs including IPv6, and do not follow redirects automatically:

```bash
validate_url() {
  local url="$1"
  # Must be HTTPS
  if [[ ! "$url" =~ ^https:// ]]; then
    echo "SKIP: non-HTTPS URL blocked" >&2
    return 1
  fi
  # Extract the host only: strip scheme, cut the authority at the first / ? or #,
  # then drop :port. Checking the host (not the whole URL) avoids false matches in
  # the path/query. Userinfo and backslashes are rejected outright: parsers disagree
  # on them, so https://evil.example?@cdn.discordapp.com/ and
  # https://cdn.discordapp.com@127.0.0.1/ must never reach curl.
  local host="${url#https://}"
  host="${host%%[/?#]*}"   # authority ends at the first /, ? or #
  if [[ "$host" == *[@\\]* ]]; then
    echo "SKIP: userinfo or backslash in URL authority blocked" >&2
    return 1
  fi
  host="${host%%:*}"   # drop :port; any bracketed IPv6 literal collapses to "[", still caught by the \[* check below
  # Block bracketed IP-literal hosts plus private/internal IPv4 ranges (SSRF protection).
  if [[ "$host" == \[* ]] || [[ "$host" =~ ^(127\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|localhost|0\.0\.0\.0|169\.254\.) ]]; then
    echo "SKIP: private/local URL blocked" >&2
    return 1
  fi
  # Strict allowlist — only exact Discord CDN hosts (no wildcard subdomains)
  if [[ "$host" =~ ^(cdn\.discordapp\.com|media\.discordapp\.net|images-ext-[0-9]+\.discordapp\.net)$ ]]; then
    return 0
  fi
  echo "SKIP: untrusted URL domain" >&2
  return 1
}
```

**External (non-CDN) URLs:** Links in message text often point at arbitrary sites. **`validate_url` is intentionally strict:** only Discord CDN patterns return success for downloads. For every other HTTPS URL, **append to `links.md` and the manifest** (use `redact_cdn_url` when logging) and **do not `curl`**. Validation applies to the URL being requested; if a CDN response redirects, inspect the `Location` header and run `validate_url` on that URL before issuing another request.

### CDN Token Redaction (CRITICAL)

Discord CDN URLs contain ephemeral authentication tokens in query parameters. **Never log, output, or persist full CDN URLs with tokens.**

```bash
redact_cdn_url() {
  local url="$1"
  url="${url%%\?*}"
  printf '%s\n' "${url%%#*}"
}
```

- Use the **full URL (with tokens)** only in the `curl` download command
- Use the **redacted URL (without query params)** in `manifest.json`, `links.md`, and all agent output
- Tokens expire quickly — persisting them is both a security risk and useless

### Suspicious Content Flagging

Flag filenames and embed titles that contain injection markers, role hijacking, or exfiltration patterns. This is a **warning layer** — flagged items are still downloaded, but surfaced in the summary report so the user knows what they're archiving.

```bash
flag_suspicious() {
  local text="$1"
  local lower=$(echo "$text" | tr '[:upper:]' '[:lower:]')

  # Instruction overrides
  if [[ "$lower" =~ (ignore.*(previous|prior|above)|disregard|override.*instruction) ]]; then
    echo "injection:instruction-override"; return 0
  fi
  # Role hijacking (whole words only, so names like exact_assets.png do not match)
  local role_hijack_re='(^|[^a-z])(you.are.now|pretend.you|act.as|new.role)([^a-z]|$)'
  if [[ "$lower" =~ $role_hijack_re ]]; then
    echo "injection:role-hijack"; return 0
  fi
  # System markup
  local system_markup_re='(<system>|\[inst\]|<<sys>>)'
  if [[ "$lower" =~ $system_markup_re ]]; then
    echo "injection:system-markup"; return 0
  fi
  # Jailbreak
  if [[ "$lower" =~ (dan.mode|developer.mode|bypass.safety|jailbreak) ]]; then
    echo "injection:jailbreak"; return 0
  fi
  # Exfiltration
  if [[ "$lower" =~ (system.prompt|your.instructions|reveal.*prompt) ]]; then
    echo "injection:exfiltration"; return 0
  fi
  # Attention hijacking (filenames like "IMPORTANT_run_this.exe")
  if [[ "$lower" =~ (^important|^critical|^urgent|run.this|execute) ]]; then
    echo "suspicious:attention-hijack"; return 0
  fi

  return 1
}
```

Run over every attachment filename and embed title during the staging step (A3/B2). Include matches in the summary report under a **Flagged Content** section.

### Collision and Repeat-Run Policy

Compare bytes, never just names or sizes. Within a dedicated archive directory, keep a byte-identical existing asset and report it as skipped. Preserve different content under the first free suffix (`photo_2.png`, `photo_3.png`). Check existing suffixed candidates too so a repeated collision does not create another copy. Never follow a destination symlink. Run one writer per archive directory.

The Bash snippets require Bash and standard file utilities (on Windows, use a configured Bash environment). This helper handles approved local assets and completed temporary downloads; the caller updates the manifest with its returned destination. Do not add a duplicate manifest asset entry on a skip.

```bash
copy_asset() {
  local source="$1" out_dir="$2" original="$3"
  if [[ ! -f "$source" || -L "$source" || ! -d "$out_dir" || -L "$out_dir" ]]; then
    echo "SKIP: source or destination is not a regular file/directory" >&2
    return 1
  fi
  local name stem ext candidate n=1
  name=$(sanitize_filename "$original") || return 1
  stem="$name"; ext=""
  if [[ "$name" == *.* ]]; then stem="${name%.*}"; ext=".${name##*.}"; fi
  candidate="$out_dir/$name"
  while [[ -e "$candidate" || -L "$candidate" ]]; do
    if [[ -f "$candidate" && ! -L "$candidate" ]] && cmp -s "$source" "$candidate"; then
      printf 'skipped\t%s\n' "$candidate"
      return 0
    fi
    n=$((n + 1))
    candidate="$out_dir/${stem}_${n}${ext}"
  done
  # Never overwrite an existing destination; verify the completed copy.
  cp -n "$source" "$candidate" && [[ ! -L "$candidate" ]] && cmp -s "$source" "$candidate" || {
    echo "ERROR: asset copy failed; inspect destination before retrying" >&2
    return 1
  }
  printf 'copied\t%s\n' "$candidate"
}
```

For live downloads, a manifest attachment ID plus a verified local content hash can avoid a repeat request. If identity or integrity is uncertain, stage a download, compare its bytes with this helper, and report the outcome. A filename or size match alone never proves duplication.

### Download Commands

**Never substitute message-derived values into command text.** URLs, filenames, embed titles, and any other Discord field reach the shell only as positional arguments or as records read from a file, never pasted into a command, a double-quoted string, or a heredoc. A URL such as `https://cdn.discordapp.com/a$(touch${IFS}PWNED).png` executes if pasted into `"..."` shell source.

```bash
download_asset() {
  # Usage: download_asset URL DEST_DIR ORIGINAL_FILENAME (all values as arguments)
  local url="$1" dest_dir="$2" original="$3" staged_asset status
  validate_url "$url" || return 1
  staged_asset=$(mktemp) || return 1
  # --disable ignores ~/.curlrc (which could enable -L); --globoff keeps [] and {} literal.
  if curl --disable --proto '=https' --globoff --fail -o "$staged_asset" "$url"; then
    copy_asset "$staged_asset" "$dest_dir" "$original"
    status=$?
  else
    status=1
  fi
  rm -f "$staged_asset"
  return "$status"
}

download_staged() {
  # Usage: download_staged STAGED_LIST HARVEST_FOLDER
  # STAGED_LIST holds one approved record per line: kind<TAB>url<TAB>original_filename,
  # where kind is images or files.
  local list="$1" harvest_folder="$2" kind url original failures=0
  while IFS=$'\t' read -r kind url original || [[ -n "$kind" ]]; do
    case "$kind" in
      images|files) ;;
      *) echo "SKIP: unknown asset kind" >&2; failures=$((failures + 1)); continue ;;
    esac
    download_asset "$url" "$harvest_folder/$kind" "$original" || {
      echo "FAILED: $(redact_cdn_url "$url")" >&2
      failures=$((failures + 1))
    }
  done < "$list"
  [[ "$failures" -eq 0 ]]
}
```

Run only after staging approval, with the helper functions above loaded. Write the staged list with the host's file-write tool or a JSON tool that escapes tabs and newlines (for example `jq -r '.[] | [.kind, .url, .filename] | @tsv'`); never build it with `echo`, `printf`, or an unquoted heredoc containing message values. Only operator-chosen paths appear in the command:

```bash
download_staged /absolute/path/to/staged-assets.tsv /absolute/path/to/discord-my-lab-resources
```

**Do NOT pass raw Discord filenames or URLs directly to `curl -o`.** A crafted filename like `../../.env` would write outside the harvest folder. A crafted URL or redirect could hit internal network endpoints (SSRF). Avoid `curl -L` here: curl can follow redirects to a different host, and `--proto-redir '=https'` restricts redirected protocols but does not re-check the host allowlist.

### Bot API Requests

Read the bot token from an environment variable or the host's secret loader; never ask for it in chat. Pass it to curl through a private header file so it never appears on a command line, and never echo it or write it to the manifest, `links.md`, or logs. Validate guild, channel, and thread IDs as digits before building a route.

```bash
discord_api() {
  # Usage: discord_api ROUTE   e.g. discord_api "/channels/$channel_id/messages?limit=10"
  local route="$1" header_file status
  [[ -n "${DISCORD_BOT_TOKEN:-}" ]] || { echo "DISCORD_BOT_TOKEN is not set" >&2; return 1; }
  header_file=$(mktemp) || return 1   # mktemp creates the file with mode 600
  printf 'Authorization: Bot %s\n' "$DISCORD_BOT_TOKEN" > "$header_file"
  curl --disable --proto '=https' --globoff --fail -H @"$header_file" "https://discord.com/api/v10$route"
  status=$?
  rm -f "$header_file"
  return "$status"
}
```

### Filename Rules

- **Always sanitize** filenames through `sanitize_filename` before use
- **Always validate** URLs through `validate_url` before downloading
- **Do not use automatic redirects** for downloads; validate any redirected `Location` URL before retrying
- Use the sanitized original filename from the URL/attachment when available
- For OG:images, prefix with `og_` and use a sanitized version of the parent URL's domain+path
- Apply the [collision and repeat-run policy](#collision-and-repeat-run-policy) to every copy/download: compare bytes, preserve different content under suffixes, and record the actual destination.

## Local Data Package and Manual-Import Staging

Discord Data Packages and user-selected import folders are local inputs, but their filenames, message fields, and URLs are still untrusted. Never execute HTML/JavaScript from the package, open message links automatically, or use an exported token/cookie to access Discord.

Use a read-only discovery pass before copying anything:

```bash
input_dir="/absolute/path/provided-by-user"
test -d "$input_dir" || { echo "Input directory not found" >&2; exit 1; }

# Inventory regular files without following symlink targets. Review output only;
# destination copies still require sanitize_filename and staging confirmation.
find -P "$input_dir" -type f -print
```

Apply these rules to Data Package records and manually exported files:

1. Parse only the data files that are actually present; Discord may revise package layout and field names.
2. Data Package Messages cover messages sent by the requesting account. Do not describe the result as a complete DM transcript.
3. Classify already-local assets as `copy`, allowlisted Discord CDN attachment URLs as `download`, external URLs as `link-only`, and symlinks/special files as `skip`.
4. Run `sanitize_filename()` and `flag_suspicious()` on every staged filename. Resolve collisions before writing.
5. Redact Discord CDN query parameters in manifests and reports. Never persist authentication material found in an export.
6. Present counts and the exact source/destination directories, then wait for confirmation.

For local copies, avoid dereferencing symlinks and preserve only regular-file bytes:

```bash
source_file="/absolute/path/provided-by-user/example.png"
test -f "$source_file" && test ! -L "$source_file" || {
  echo "SKIP: source is not a regular non-symlink file" >&2
  exit 1
}
copy_asset "$source_file" "{harvest_folder}/images" "$(basename -- "$source_file")"
```

The bot API remains the only automated live-Discord path. Do not add browser-DOM extraction, self-bot clients, or authenticated-session scraping as a fallback.
