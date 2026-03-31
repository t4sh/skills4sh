# Display Conventions — Full Reference

When showing memory files or project documents to the user, **always render them inline in the chat** rather than opening external editors. This applies to all interfaces (Claude App, Claude Code CLI, VSCode, Craft Agent).

## Universal (works everywhere)

| Format | How to Display |
|--------|---------------|
| **Markdown** (`.md`) | Render the file body directly as inline markdown (strip YAML frontmatter — show only the body, optionally with the `title` as a heading) |
| **YAML** (`.yaml`, `.yml`) | Render in a `yaml` fenced code block |
| **JSON** (`.json`) | Render in a `json` fenced code block |
| **Plain text** (`.txt`, `.log`) | Render in a plain fenced code block |

## Rich Previews (when interface supports them)

If the interface supports rich preview blocks (e.g., Craft Agent), prefer these for binary and rich formats. Otherwise, fall back to describing the file with its path as a clickable link.

| Format | Rich Preview | Fallback |
|--------|-------------|----------|
| **PDF** (`.pdf`) | `pdf-preview` code block with `"src"` | Show file path as link + page count |
| **Images** (`.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.svg`) | `image-preview` code block with `"src"` | Show file path as link |
| **HTML** (`.html`) | `html-preview` code block with `"src"` | Show file path as link |
| **Multiple files** | Use `items` array with tabs | Render each under a heading |
| **Index / tables** | `datatable` code block | `yaml` code block |

## Guidelines

- **Never open external editors** unless the user explicitly asks to edit a file externally.
- **Strip frontmatter for markdown display.** Omit the `---` YAML frontmatter block — show only the markdown body.
- **Large files.** For very long markdown files, summarize and offer to show specific sections. For PDFs over 10 pages, note the page count.
- **Index display.** When showing `index.yaml`, use whichever format is most readable — a table, datatable, or yaml code block.
