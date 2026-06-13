# Design Philosophy

discord-harvest is **stateless, extract-only, and lean by design**.

## Principles

- **Attachments leave, conversations stay.** Only media assets and link URLs are extracted. Message text is never stored — the conversation remains in Discord. `manifest.json` records filenames and redacted URLs, not what people said.
- **No database, no runtime, no persistent process.** Output is flat files (`images/`, `files/`, `links.md`, `manifest.json`). No SQLite, no vector index, no background service.
- **No platform-specific dependencies.** `curl` for downloads, bot API or any browser for reading. No .NET, no Python ML stack, no Node runtime. Runs anywhere with a shell.
- **No global state.** No `~/.config/` directory, no cached tokens, no credential management. Auth stays in Discord (the bot token the user already has, or the browser session they're already logged into). Each run is self-contained.
- **Incremental by disk, not by database.** Repeat runs check what's already on disk (`skip existing files`, append to `links.md`, merge into `manifest.json`). Resolved server/channel IDs are cached inside the harvest folder's `manifest.json` — state lives with the output, not globally. Delete the folder and the cache goes with it.
- **Cross-platform by default.** No Keychain integration, no OS-specific tooling. The same skill works on macOS, Linux, and Windows without adaptation.

## Tradeoffs

This leanness is intentional. Heavier alternatives exist, such as DiscordChatExporter plus SQLite pipelines or MCP server approaches with persistent memory. discord-harvest trades that infrastructure for portability, simplicity, and a smaller attack surface: not storing message content means not needing to secure it.
