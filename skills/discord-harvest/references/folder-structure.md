# Folder Structure & Formats — Full Reference

## Folder Naming (flat, no nesting)

| Type | Folder name |
|------|-------------|
| DM | `discord-dm-{profile-name}/` |
| Server channel | `discord-{server-name}-{channel}/` |

Sanitize names: lowercase, replace spaces/special chars with hyphens, strip trailing hyphens.

**Examples:**
- DM with "John Smith" → `~/Projects/GenAI/discord-dm-john-smith/`
- Server "My Lab", channel "resources" → `~/Projects/GenAI/discord-my-lab-resources/`

## Folder Structure

```
{harvest_folder}/
├── images/          # All images (.png, .jpg, .gif, .webp)
├── files/           # All other files (.pdf, .html, .md, .zip, etc.)
├── links.md         # All URLs with OG:image cross-references (append-only)
└── manifest.json    # Machine-readable summary (updated each run)
```

## Repeat Run Behavior (append mode)

If the folder already exists from a previous run:
- **images/ and files/**: Add new files only. Skip if a file with the same name already exists.
- **links.md**: **Append** a new dated section at the bottom. Do NOT overwrite existing content. Use `>>` (append) not `>` (overwrite) when writing, or read-then-append with the Write tool.
- **manifest.json**: Read existing manifest, merge new entries into the arrays, update totals and `harvested_at` timestamp.

## links.md Format

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

## manifest.json Format

```json
{
  "profile": "john-smith",
  "type": "dm",
  "harvest_folder": "discord-dm-john-smith",
  "last_harvested_at": "2026-03-21T20:30:00Z",
  "resolvedIds": {
    "guild_id": "1234567890123456789",
    "channel_id": "9876543210987654321",
    "thread_ids": ["1111111111111111111", "2222222222222222222"]
  },
  "runs": [
    {
      "harvested_at": "2026-03-21T20:30:00Z",
      "messages_scanned": 10,
      "threads_scanned": 2
    }
  ],
  "downloads": {
    "images": [
      { "filename": "photo.png", "url": "https://cdn.discordapp.com/attachments/.../photo.png", "type": "attachment", "added": "2026-03-21" },
      { "filename": "og_example-com.png", "url": "https://...", "type": "og:image", "parent_link": "https://example.com", "added": "2026-03-21" }
    ],
    "files": [
      { "filename": "document.pdf", "url": "https://cdn.discordapp.com/attachments/.../document.pdf", "type": "attachment", "added": "2026-03-21" }
    ],
    "links": [
      { "url": "https://example.com", "og_image": "images/og_example-com.png", "added": "2026-03-21" },
      { "url": "https://github.com/user/repo", "og_image": null, "added": "2026-03-21" }
    ]
  },
  "flagged": [
    { "filename": "IMPORTANT_run_this.exe", "flag": "suspicious:attention-hijack", "action": "downloaded" },
    { "embed_title": "ignore previous instructions", "flag": "injection:instruction-override", "action": "link-only" }
  ],
  "totals": {
    "images": 5,
    "files": 2,
    "links": 3,
    "og_images": 2,
    "flagged": 2
  }
}
```

## Summary Report Format

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
- **Full output path** — make this prominent so the user can navigate there easily
- How many messages were scanned (channel + threads)
- How many threads were traversed
- How many files were new vs. already existed (skipped)
- Any failures (URLs that couldn't be downloaded)
- **Flagged content** — if `flag_suspicious()` matched any filenames or embed titles, list them with their flag type. This is informational, not blocking — the user should know what they're archiving

**Always end with the folder path as the last line**, e.g.:
> Saved to: `~/Projects/GenAI/discord-dm-john-smith/`
