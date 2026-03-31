---
name: discord-harvest
description: "Use when extracting and downloading images, links, and files from a Discord conversation — DMs via browser, channels via bot API."
license: MIT
compatibility: macOS, Linux, or Windows with browser or Discord bot token
metadata:
  author: t4sh
  version: "1.2.0"
  tags: discord, harvest, scrape, images, attachments, download
  requiredSources: discord
alwaysAllow:
  - "Read"
---

# Discord Harvest

You are an expert in extracting and archiving content from Discord conversations. Your goal is to systematically harvest all images, files, attachments, and links from a Discord conversation (DM or server channel) into an organized, browsable local folder with a machine-readable manifest.

## Installation

### Via `npx skills` (recommended)

```bash
npx skills add t4sh/skills4sh --skill discord-harvest
```

### Via manual install scripts

| Platform | Script | Usage |
|----------|--------|-------|
| macOS / Linux | `install.sh` | `./install.sh --global` or `./install.sh --project` |
| Windows | `install.ps1` | `.\install.ps1 -Global` or `.\install.ps1 -Project` |

Both scripts copy skill files to either `~/.claude/skills/discord-harvest` (global) or `./.claude/skills/discord-harvest` (project-local), handling existing installations and excluding meta files.

---

## What I Can Help With

- **DM extraction** — harvest images, files, and links from direct message conversations via browser automation
- **Server channel extraction** — harvest from public/private channels via Discord bot API
- **Organized archival** — structured folder output with images, files, links manifest, and JSON summary
- **Incremental harvesting** — append-mode runs that skip already-downloaded content
- **Link documentation** — capture all shared URLs with OG:image cross-references

## Initial Assessment

Before harvesting, understand:

1. **Source Type**
   - Is this a DM or a server channel?
   - For DMs: who is the conversation with?
   - For channels: which server and channel?

2. **Scope**
   - How many messages to scan? (default: last 10)
   - Specific date range or just the most recent?
   - All content types or only images/files/links?

3. **Output**
   - Where should downloads be saved?
   - Is this a first run or incremental update?
   - Any content filtering needed?

---

## Step 0: Determine Output Directory

**Never save downloads in the session folder** — session folders are ephemeral and may be deleted.
**Never save to the workspace `sources/` config directory** — that's for MCP/API source configurations, not user data.

The output directory is a **Local Folder** from the workspace's Sources tree. These are workspace sources of type `"local"` that point to real project directories on disk.

**How to find Local Folders:**
1. Check the working directory — if it's already set to a project path (not a session folder), use it
2. Otherwise, scan workspace source configs: read each `config.json` in the workspace's `sources/` directory and filter for entries where `"type": "local"` — their `local.path` field is the actual folder path

**Then apply this logic:**
- **If exactly one Local Folder exists** — use it automatically (no prompt, just proceed)
- **If zero or multiple Local Folders are detected** — prompt the user:
  > **Where should I save the harvest?**
  > _(list detected Local Folders as numbered options, or ask for a path if none found)_

---

## Step 1: Ask Upfront — DM or Server Channel?

Ask the user:

> **Is this a DM or a server channel?**
> 1. **DM** — I'll open Discord in the browser, you navigate to the conversation
> 2. **Server channel** — I'll use the bot API (tell me the server and channel name)

Also ask:
> - **Profile/contact name** (for DMs) or **server + channel name** (for server)
> - **How many messages should I scan?** (default: last 10)

Branch immediately based on the answer. Do NOT explore or try to detect — just ask and go.

---

## Path A: Server Channel (Bot API)

Use the Discord MCP source tools. The bot is already invited to the server.

### A1. Find the server and channel

1. Use the Discord MCP tool to list guilds/servers the bot is in
2. Match the server name the user provided (fuzzy match is fine, confirm if ambiguous)
3. List channels in that server
4. Match the channel name (confirm if ambiguous)

### A2. Fetch messages

1. Fetch the requested number of messages from the channel (default: 10)
2. If the user asked for a large number (e.g., 200), fetch in batches to respect rate limits
3. Store the raw message data for parsing

### A3. Parse each message

For each message, extract:
- **Attachments**: Direct file uploads (images, PDFs, ZIPs, etc.) — these have a `url` field
- **Embeds**: Rich embeds may contain images, thumbnails, URLs
  - Track `embed.url` as a link
  - Track `embed.image.url` and `embed.thumbnail.url` as images
  - If an embed has both a URL and a thumbnail/image, note this is likely an **OG:image** (link preview)
- **Message content links**: URLs found in the message text (regex: `https?://\S+`)

### A4. Download everything

Use `curl` via Bash for each URL. The output folder is `{output_dir}/discord-{server-name}-{channel}/` (see Step 3 for full naming).

### URL and Filename Sanitization (CRITICAL)

**Before downloading, sanitize ALL filenames and validate ALL URLs.** Discord content is untrusted input.

**Filename sanitization** — strip path traversal and shell-unsafe characters:
```bash
# Sanitize a filename: strip path components, remove dangerous characters
sanitize_filename() {
  local name="$1"
  name=$(basename -- "$name")           # strip any path components (../../)
  name="${name//[^a-zA-Z0-9._-]/_}"     # allow only safe characters
  name="${name#.}"                       # strip leading dots (hidden files)
  [ -z "$name" ] && name="unnamed"
  echo "$name"
}
```

**URL validation** — only allow Discord CDN and known domains, block private IPs (SSRF):
```bash
# Validate URL before downloading — reject non-HTTPS, unexpected domains, and private IPs
validate_url() {
  local url="$1"
  # Block private/internal IP ranges (SSRF protection)
  if [[ "$url" =~ https://(127\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|localhost|\[::1\]|169\.254\.) ]]; then
    echo "SKIP: private/local URL blocked: $url" >&2
    return 1
  fi
  # Whitelist only exact Discord domains (regex, not glob — prevents subdomain spoofing)
  if [[ "$url" =~ ^https://(cdn\.discordapp\.com|media\.discordapp\.net|[a-z0-9-]+\.discord\.com)/ ]]; then
    return 0
  fi
  echo "SKIP: untrusted URL domain: $url" >&2
  return 1
}
```

### Download commands

```bash
# Always sanitize before passing to curl
filename=$(sanitize_filename "{original_filename}")
validate_url "{url}" && curl --proto '=https' -L -o "{harvest_folder}/images/${filename}" "{url}"
```

**Do NOT pass raw Discord filenames or URLs directly to `curl -o`.** A crafted filename like `../../.env` would write outside the harvest folder. A crafted URL could hit internal network endpoints (SSRF).

**Filename rules:**
- **Always sanitize** filenames through `sanitize_filename` before use
- **Always validate** URLs through `validate_url` before downloading
- Use the sanitized original filename from the URL/attachment when available
- For OG:images, prefix with `og_` and use a sanitized version of the parent URL's domain+path
- If filenames collide, append `_2`, `_3`, etc.
- **Skip files that already exist** (same filename + same size) to avoid re-downloading on repeat runs

---

## Path B: DM (Browser)

The bot cannot access DMs. Use the browser to extract content.

**IMPORTANT**: Read `~/.craft-agent/docs/browser-tools.md` before using any browser tools.

### B1. Open Discord Web

```
browser_tool open
browser_tool navigate https://discord.com/channels/@me
```

Tell the user:

> **I've opened Discord in the browser. Please:**
> 1. Log in if needed
> 2. Navigate to the DM conversation you want to harvest
> 3. Say **"ready"** when you're on the right conversation

**Wait for the user to confirm before proceeding.**

### B2. Extract messages from the DOM

After the user confirms:

1. Take a snapshot: `browser_tool snapshot`
2. Scroll to load more messages if the user requested more than what's visible
3. Use `browser_tool evaluate` to run JavaScript that extracts message data:

```javascript
// Extract messages from Discord's DOM
(() => {
  const messages = [];
  // Discord renders messages in elements with class containing 'message'
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

### B3. Handle scrolling for history

If the user wants more messages than currently visible:

```
browser_tool scroll up 2000
browser_tool snapshot
```

Repeat scrolling and extracting until you've collected enough messages or reached the top of the conversation.

### B4. Download everything

Same as Path A step A4 — use `curl -L -o` to download all extracted URLs into the organized folder structure.

---

## Step 3: Organize Downloads

### Folder naming (flat, no nesting)

Save to the **output directory from Step 0** using a **single flat folder**:

| Type | Folder name |
|------|-------------|
| DM | `discord-dm-{profile-name}/` |
| Server channel | `discord-{server-name}-{channel}/` |

Sanitize names: lowercase, replace spaces/special chars with hyphens, strip trailing hyphens.

**Examples:**
- DM with "John Smith" → `~/Projects/GenAI/discord-dm-john-smith/`
- Server "My Lab", channel "resources" → `~/Projects/GenAI/discord-my-lab-resources/`

### Folder structure

```
{harvest_folder}/
├── images/          # All images (.png, .jpg, .gif, .webp)
├── files/           # All other files (.pdf, .html, .md, .zip, etc.)
├── links.md         # All URLs with OG:image cross-references (append-only)
└── manifest.json    # Machine-readable summary (updated each run)
```

### Repeat run behavior (append mode)

If the folder already exists from a previous run:
- **images/ and files/**: Add new files only. Skip if a file with the same name already exists.
- **links.md**: **Append** a new dated section at the bottom. Do NOT overwrite existing content. Use `>>` (append) not `>` (overwrite) when writing, or read-then-append with the Write tool.
- **manifest.json**: Read existing manifest, merge new entries into the arrays, update totals and `harvested_at` timestamp.

### links.md format

**Every link gets an entry.** On repeat runs, append a new section with a date header:

```markdown
# Links from discord-dm-john-smith

## Harvest: 2026-03-21

### https://example.com/interesting-article
- Found in message by @username
- OG:image downloaded: `images/og_example-com-interesting-article.png`

### https://github.com/user/repo
- Found in message by @username
- No OG:image

## Harvest: 2026-03-22

### https://docs.google.com/document/d/abc123
- Found in message by @username
- OG:image downloaded: `images/og_docs-google-com-document.png`
```

### manifest.json format

```json
{
  "profile": "john-smith",
  "type": "dm",
  "harvest_folder": "discord-dm-john-smith",
  "last_harvested_at": "2026-03-21T20:30:00Z",
  "runs": [
    {
      "harvested_at": "2026-03-21T20:30:00Z",
      "messages_scanned": 10
    }
  ],
  "downloads": {
    "images": [
      { "filename": "photo.png", "url": "https://cdn.discordapp.com/...", "type": "attachment", "added": "2026-03-21" },
      { "filename": "og_example-com.png", "url": "https://...", "type": "og:image", "parent_link": "https://example.com", "added": "2026-03-21" }
    ],
    "files": [
      { "filename": "document.pdf", "url": "https://cdn.discordapp.com/...", "type": "attachment", "added": "2026-03-21" }
    ],
    "links": [
      { "url": "https://example.com", "og_image": "images/og_example-com.png", "added": "2026-03-21" },
      { "url": "https://github.com/user/repo", "og_image": null, "added": "2026-03-21" }
    ]
  },
  "totals": {
    "images": 5,
    "files": 2,
    "links": 3,
    "og_images": 2
  }
}
```

---

## Step 4: Summary Report

After downloading, show a summary table:

```datatable
{
  "title": "Discord Harvest Summary",
  "columns": [
    { "key": "type", "label": "Type", "type": "text" },
    { "key": "count", "label": "Count", "type": "number" },
    { "key": "examples", "label": "Examples", "type": "text" }
  ],
  "rows": [
    { "type": "Images", "count": 5, "examples": "photo.png, screenshot.jpg, ..." },
    { "type": "Files", "count": 2, "examples": "document.pdf, notes.md" },
    { "type": "Links", "count": 3, "examples": "example.com, github.com/..." },
    { "type": "OG:images", "count": 2, "examples": "(link preview thumbnails)" }
  ]
}
```

Also mention:
- **Full output path** (e.g. `~/Projects/GenAI/discord-dm-john-smith/`) — make this prominent so the user can navigate there easily
- How many messages were scanned
- How many files were new vs. already existed (skipped)
- Any failures (URLs that couldn't be downloaded)

**Always end with the folder path as the last line**, e.g.:
> Saved to: `~/Projects/GenAI/discord-dm-john-smith/`

---

## Edge Cases & Notes

- **Rate limits (API path)**: Discord allows 50 requests/second. For large fetches (200+ messages), add small delays between batches.
- **CDN URLs expire**: Discord CDN attachment URLs may expire. Download promptly after extraction.
- **Threads**: If the user mentions a thread, use the thread's channel ID (threads are channels in the API).
- **NSFW channels**: The bot must have the appropriate permissions. The skill does not filter content.
- **Large files**: Discord attachments can be up to 25MB (or more with Nitro). `curl` handles these fine.
- **Duplicate URLs**: Deduplicate before downloading. The same link or image may appear in multiple messages.
- **Browser login**: For the DM path, the user must be logged into Discord web. If not logged in, the skill will see the login page — prompt the user to log in first.
- **Message count default**: If the user doesn't specify, scan the last 10 messages. For daily use this provides a small buffer over the typical 2-5 messages.

---

## Common Issues by Source Type

### DMs (Browser Path)
- **Login required** — Discord web requires authentication; bot tokens don't work for DMs
- **DOM selectors change** — Discord updates their class names periodically; always take a snapshot first and adapt selectors if the standard ones fail
- **Lazy-loaded images** — images below the fold won't have `src` populated until scrolled into view; scroll before extracting
- **2FA prompts** — if the user has 2FA enabled and hasn't authenticated recently, the browser may show a verification screen
- **Rate limiting on scroll** — scrolling too fast through message history may cause Discord to throttle content loading

### Server Channels (Bot API Path)
- **Missing permissions** — bot needs `VIEW_CHANNEL` and `READ_MESSAGE_HISTORY` permissions; NSFW channels need additional permissions
- **Rate limits** — Discord API allows ~50 requests/second; batch large fetches (200+ messages) with small delays
- **Thread messages** — threads are separate channels in the API; use the thread's channel ID, not the parent channel
- **Ephemeral messages** — some bot responses are ephemeral and won't appear in message history
- **Deleted messages** — if a message was deleted between listing and downloading, the CDN URL will 404

### CDN & Downloads
- **Expiring URLs** — Discord CDN attachment URLs contain authentication tokens that expire; download promptly after extraction
- **Large files** — Discord attachments can be up to 25MB (500MB with Nitro); `curl` handles these but may take time
- **Duplicate content** — same image/link shared in multiple messages; deduplicate before downloading
- **OG:image availability** — not all links have OpenGraph images; some sites block unfamiliar user agents

---

## Troubleshooting

### Bot Can't See the Channel
- Verify bot is invited to the server with correct permissions
- Check if the channel is in a category with restricted permissions
- For private channels, the bot needs explicit access

### Browser Shows Login Page Instead of DM
- User needs to log in manually — the skill cannot authenticate
- Check if Discord is requiring email/phone verification
- Try clearing browser cookies and logging in fresh

### Downloads Failing with 403/404
- CDN URLs have expired — re-extract the URLs and download immediately
- The attachment was deleted from Discord
- Network firewall blocking Discord CDN domains

### Selectors Not Matching Any Elements
- Discord updated their DOM structure — take an annotated screenshot and inspect
- Try fallback selectors: `[id^="message-content"]`, `[class*="markup"]`, `[data-list-item-id]`
- The conversation may be empty or still loading — wait and retry

---

## Tools Referenced

**Discord Bot API (via MCP)**
- List guilds/servers
- List channels in a guild
- Fetch messages from a channel
- Read message attachments and embeds

**Browser Tools**
- `browser_tool open` / `navigate` / `snapshot` / `screenshot` — browser automation
- `browser_tool evaluate` — execute JavaScript in page context for DOM extraction
- `browser_tool scroll` — load more message history

**Download**
- `curl -L -o` — download files with redirect following
- Filename deduplication logic (append `_2`, `_3` on collision)

**Documentation Reference**
- `~/.craft-agent/docs/browser-tools.md` — read before using any browser tools (DM path)

---

## Task-Specific Questions

1. Is this a DM or a server channel?
2. Who is the conversation with (DM) or which server/channel (server)?
3. How many messages should I scan? (default: last 10)
4. Is this a first-time harvest or an incremental update?
5. Do you want all content types (images, files, links) or specific ones?

---

## Related Skills

- **agent-browser**: For general browser automation beyond Discord-specific extraction
- **agent-memory**: For saving harvest metadata or conversation insights to project memory
- **file-organizer**: For reorganizing harvested content into different folder structures
