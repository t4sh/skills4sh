# Troubleshooting & Common Issues — Full Reference

## Defaults

- **Message count:** last 10 messages when the user does not specify scope
- **Content types:** images, files, and links unless the user narrows the request
- **DM/account path:** requires a local Discord Data Package or files the user exported manually; bot tokens cannot read normal user DMs

## Edge Cases

- **Rate limits (API):** Discord uses **per-route** limits (429 with `Retry-After`). Batch large fetches (200+), backoff on 429, and do not assume a single global requests-per-second ceiling.
- **CDN URLs expire:** download promptly after extraction; re-fetch message URLs if downloads 403/404.
- **Threads:** separate API channels — list active and archived threads after the parent channel; attachments only in threads will not appear in parent messages.
- **Large files:** Discord attachment limits vary by account, server plan, and policy changes; do not hard-code a size assumption. `curl` handles large downloads but they may take time.
- **Duplicates:** deduplicate before downloading.
- **Data Package scope:** the Messages export covers messages sent by the requesting account, not a complete transcript of received DM content.

## Common Issues by Source Type

### DMs and account exports (local paths)
- **Data Package not requested yet** — ask the user to request it through Discord's documented account-data flow; do not automate the request or log in for them
- **Incomplete DM history** — the package contains messages sent by the requesting account. Ask the user to download received attachments manually when they are needed
- **Package layout changed** — inspect the delivered archive and identify its Messages data files; do not depend on a hard-coded directory layout
- **Expired CDN URLs** — report them. Do not recover them by scraping Discord Web or reusing browser/session credentials
- **Manual import has symlinks or special files** — skip them; copy only regular non-symlink files after staging confirmation

### Server Channels (Bot API Path)
- **Missing permissions** — bot needs `VIEW_CHANNEL` and `READ_MESSAGE_HISTORY` permissions; NSFW channels need additional permissions
- **Rate limits** — per-route 429 responses with `Retry-After`; batch large fetches (200+ messages) with backoff between batches
- **Thread messages** — threads are separate channels in the API. After fetching the main channel, list active guild threads (`GET /guilds/{guild.id}/threads/active`) and filter results to the target parent channel, then list archived channel threads (`GET /channels/{id}/threads/archived/public`). Fetch each thread's messages using the thread's channel ID. Attachments shared only in threads won't appear in the parent channel.
- **Ephemeral messages** — some bot responses are ephemeral and won't appear in message history
- **Deleted messages** — if a message was deleted between listing and downloading, the CDN URL will 404

### CDN & Downloads
- **Expiring URLs** — Discord CDN attachment URLs contain authentication tokens that expire; download promptly after extraction
- **Large files** — Discord attachment limits vary by account, server plan, and policy changes; do not hard-code a size assumption. `curl` handles large downloads but they may take time
- **Duplicate content** — same image/link shared in multiple messages; deduplicate before downloading
- **OG:image availability** — not all links have OpenGraph images; some sites block unfamiliar user agents

### Staging & Flagged Content
- **Staging summary shows flagged items** — `flag_suspicious()` matched injection patterns in a filename or embed title. These are warnings, not blocks. Review the flagged items and proceed if they look benign (e.g., a file genuinely named "important_notes.pdf"). The flag is recorded in `manifest.json` for audit.
- **User declines at staging prompt** — no downloads happen. The staging data is discarded. Re-run with adjusted scope or content type filters.
- **Resolved IDs in manifest.json return errors on re-run** — the channel or thread was deleted or the bot lost access. Discard the stale ID from `resolvedIds` and re-resolve via API.

## Troubleshooting

### Bot Can't See the Channel
- Verify bot is invited to the server with correct permissions
- Check if the channel is in a category with restricted permissions
- For private channels, the bot needs explicit access

### User asks to scrape Discord Web or use a self-bot
- Refuse that acquisition method because it automates a normal user account or authenticated Discord session
- Offer the bot API for an authorized server channel
- Offer a user-provided Discord Data Package for their sent-message data
- Offer a manually exported local folder for received DM files or other gaps

### Downloads Failing with 403/404
- CDN URLs have expired — re-extract the URLs and download immediately
- The attachment was deleted from Discord
- Network firewall blocking Discord CDN domains

### Export does not contain the requested conversation
- Confirm the package belongs to the expected account and that the user selected the correct local archive
- Explain that received messages are outside the requesting account's sent-message export
- Continue only with files the user manually exports into a local folder; do not fall back to browser automation
