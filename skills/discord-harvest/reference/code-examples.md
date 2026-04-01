# Code Examples — Full Reference

## URL and Filename Sanitization (CRITICAL)

**Before downloading, sanitize ALL filenames and validate ALL URLs.** Discord content is untrusted input.

### Filename Sanitization

Strip path traversal and shell-unsafe characters:

```bash
sanitize_filename() {
  local name="$1"
  name=$(basename -- "$name")           # strip any path components (../../)
  name="${name//[^a-zA-Z0-9._-]/_}"     # allow only safe characters
  name="${name#.}"                       # strip leading dots (hidden files)
  name="${name%%.*}.${name#*.}"          # collapse multiple extensions (foo.tar.gz → foo.tar)
  name="${name:0:200}"                   # truncate to 200 chars max
  [ -z "$name" ] || [ "$name" = "." ] && name="unnamed"
  echo "$name"
}
```

### URL Validation

Only allow exact Discord CDN domains, block private/internal IPs including IPv6 (SSRF):

```bash
validate_url() {
  local url="$1"
  # Must be HTTPS
  if [[ ! "$url" =~ ^https:// ]]; then
    echo "SKIP: non-HTTPS URL blocked: $url" >&2
    return 1
  fi
  # Block private/internal IP ranges including IPv6 (SSRF protection)
  if [[ "$url" =~ https://(127\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|localhost|\[::1\]|\[fe80:|\[fc00:|\[fd00:|0\.0\.0\.0|169\.254\.) ]]; then
    echo "SKIP: private/local URL blocked: $url" >&2
    return 1
  fi
  # Strict allowlist — only exact Discord CDN domains (no wildcard subdomains)
  if [[ "$url" =~ ^https://(cdn\.discordapp\.com|media\.discordapp\.net|images-ext-[0-9]+\.discordapp\.net)/ ]]; then
    return 0
  fi
  echo "SKIP: untrusted URL domain: $url" >&2
  return 1
}
```

### CDN Token Redaction (CRITICAL)

Discord CDN URLs contain ephemeral authentication tokens in query parameters. **Never log, output, or persist full CDN URLs with tokens.**

```bash
redact_cdn_url() {
  local url="$1"
  echo "${url%%\?*}"
}
```

- Use the **full URL (with tokens)** only in the `curl` download command
- Use the **redacted URL (without query params)** in `manifest.json`, `links.md`, and all agent output
- Tokens expire quickly — persisting them is both a security risk and useless

### Download Commands

```bash
# Always sanitize before passing to curl
filename=$(sanitize_filename "{original_filename}")
validate_url "{url}" && curl --proto '=https' -L -o "{harvest_folder}/images/${filename}" "{url}"
```

**Do NOT pass raw Discord filenames or URLs directly to `curl -o`.** A crafted filename like `../../.env` would write outside the harvest folder. A crafted URL could hit internal network endpoints (SSRF).

### Filename Rules

- **Always sanitize** filenames through `sanitize_filename` before use
- **Always validate** URLs through `validate_url` before downloading
- Use the sanitized original filename from the URL/attachment when available
- For OG:images, prefix with `og_` and use a sanitized version of the parent URL's domain+path
- If filenames collide, append `_2`, `_3`, etc.
- **Skip files that already exist** (same filename + same size) to avoid re-downloading on repeat runs

## DM DOM Extraction Script

```javascript
// Extract messages from Discord's DOM
(() => {
  const messages = [];
  const msgElements = document.querySelectorAll('[class*="messageListItem"]');

  msgElements.forEach(el => {
    const content = el.querySelector('[class*="messageContent"]');
    const attachments = el.querySelectorAll('[class*="imageWrapper"] img, [class*="attachment"]');
    const links = content ? content.querySelectorAll('a[href]') : [];

    const msg = {
      text: content ? content.textContent.trim() : '',
      images: [],
      attachmentUrls: [],
      links: []
    };

    attachments.forEach(att => {
      const src = att.src || att.href;
      if (src && src.startsWith('http')) {
        if (src.match(/\.(png|jpg|jpeg|gif|webp)/i)) {
          msg.images.push(src);
        } else {
          msg.attachmentUrls.push(src);
        }
      }
    });

    links.forEach(a => {
      const href = a.href;
      if (href && !href.includes('discord.com') && href.startsWith('http')) {
        msg.links.push(href);
      }
    });

    if (msg.text || msg.images.length || msg.attachmentUrls.length || msg.links.length) {
      messages.push(msg);
    }
  });

  return JSON.stringify(messages);
})()
```

**Note:** Discord's DOM classes change occasionally. If the above selectors don't work:
- Take a screenshot: `browser_tool screenshot --annotated`
- Inspect the DOM structure and adapt the selectors
- Look for `[id^="message-content"]`, `[class*="markup"]`, or `[data-list-item-id]` as fallbacks
