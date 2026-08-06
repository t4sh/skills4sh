# Design Philosophy

discord-harvest is **stateless, extract-only, and lean by design**.

## Principles

- **Attachments leave, conversations stay.** Only media assets and link URLs are extracted. Message text is never stored — the conversation remains in Discord. `manifest.json` records filenames and redacted URLs, not what people said.
- **No database, no runtime, no persistent process.** Output is flat files (`images/`, `files/`, `links.md`, `manifest.json`). No SQLite, no vector index, no background service.
- **Supported inputs only.** Use Discord's bot API for authorized server channels, a user-provided Discord Data Package for the requesting account's sent messages, or files the user exported manually. Never automate a normal user account or scrape an authenticated Discord Web session.
- **No platform-specific dependencies.** Use `curl` for allowlisted CDN downloads and ordinary local-file tooling for user-provided exports. No self-bot client, browser automation, .NET exporter, Python ML stack, or persistent Node runtime is required.
- **No global state.** No `~/.config/` directory, cached user sessions, or credential management. Bot authentication remains outside the harvest output; local exports are read from the path the user explicitly provides. Each run is self-contained.
- **Incremental by disk, not by database.** Repeat runs check what's already on disk (`skip existing files`, append to `links.md`, merge into `manifest.json`). Resolved server/channel IDs are cached inside the harvest folder's `manifest.json` — state lives with the output, not globally. Delete the folder and the cache goes with it.
- **Cross-platform by default.** No Keychain integration, no OS-specific tooling. The same skill works on macOS, Linux, and Windows without adaptation.

## Tradeoffs

This leanness is intentional. Heavier export pipelines may offer broader history, but they must still comply with Discord's platform rules and the user's authorization. discord-harvest trades that infrastructure for portability, simplicity, and a smaller attack surface: no user-account automation, no stored session credentials, and no message text in its output.
