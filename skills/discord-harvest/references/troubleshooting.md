# Troubleshooting & Common Issues — Full Reference

## Defaults

- **Message count:** last 10 messages when the user does not specify scope
- **Content types:** images, files, and links unless the user narrows the request
- **DM/account path:** requires a local Discord Data Package or files the user exported manually; bot tokens cannot read normal user DMs

## Edge Cases

- **Rate limits (API):** Discord applies **per-route** limits and a global limit of 50 requests per second per bot (429 with `Retry-After`). Batch large fetches (200+) and wait the `Retry-After` seconds that `discord_api()` reports on a 429. 401, 403, and 429 responses also count toward an invalid-request limit (10,000 per 10 minutes per IP), so never repeat a rejected request unchanged.
- **CDN URLs expire:** download promptly after extraction; re-fetch message URLs if downloads 403/404.
- **Threads:** separate API channels — list active and archived threads after the parent channel; attachments only in threads will not appear in parent messages.
- **Large files:** Discord attachment limits vary by account, server plan, and policy changes; do not hard-code a size assumption. `curl` handles large downloads but they may take time.
- **Duplicates:** deduplicate before downloading.
- **Data Package scope:** the Messages export covers messages sent by the requesting account, not a complete transcript of received DM content.

## Common Issues by Source Type

### DMs and account exports (local paths)
- **Data Package not requested yet** — ask the user to request it through Discord's documented account-data flow; do not automate the request or log in for them. The user's steps on desktop or browser: User Settings (cogwheel) → **Data & Privacy** → **Request your data** → **Request Data**, then select which data to receive (this skill reads the package's Messages data). Mobile can only request all data. Discord emails a download link to the account's address; it can take up to 30 days, and a new request cannot be submitted until the current one finishes
- **Package supplied as a `.zip`** — the package is delivered as a ZIP. Ask the user to extract it into a new, empty directory, or follow the entry-name check in [code-examples.md](code-examples.md#local-data-package-and-manual-import-staging) before extracting; never extract into an existing directory
- **Incomplete DM history** — the package contains messages sent by the requesting account. Ask the user to download received attachments manually when they are needed
- **Package layout changed** — inspect the delivered archive and identify its Messages data files; do not depend on a hard-coded directory layout
- **Expired CDN URLs** — report them. Do not recover them by scraping Discord Web or reusing browser/session credentials
- **Manual import has symlinks or special files** — skip them; copy only regular non-symlink files after staging confirmation

### Server Channels (Bot API Path)
- **Missing permissions** — bot needs `VIEW_CHANNEL` and `READ_MESSAGE_HISTORY` permissions; NSFW channels need additional permissions
- **HTTP 401 from the API** — the bot token was rejected. Stop all requests and ask the user to correct `DISCORD_BOT_TOKEN` outside chat. Never respond by changing the auth scheme (dropping the `Bot ` prefix, `Bearer`, a user token, a session cookie, or a logged-in client); see the [status table](code-examples.md#bot-api-requests)
- **Rate limits** — per-route and global 429 responses with `Retry-After`; batch large fetches (200+ messages) and wait the reported seconds between retries
- **Channel missing from the channel list** — since 2026-11-16, `GET /guilds/{guild.id}/channels` omits every channel the bot lacks `VIEW_CHANNEL` on, so an absent channel can mean "no access" rather than "does not exist". Report both possibilities and ask the user to grant the bot access or supply the channel ID; never guess a similarly named channel
- **Thread messages** — threads are separate channels in the API. After fetching the main channel, list active guild threads (`GET /guilds/{guild.id}/threads/active`) and filter results to the target parent channel, then list archived channel threads (`GET /channels/{id}/threads/archived/public`). Fetch each thread's messages using the thread's channel ID. Attachments shared only in threads won't appear in the parent channel.
- **Archived-thread paging and private threads** — archived-thread responses carry `has_more`; when it is true, request the next page with the `before` query parameter until it is false. `GET /channels/{id}/threads/archived/private` additionally requires `MANAGE_THREADS`; when the bot lacks it, state in the summary that private archived threads were not covered
- **Forum and media channels** — `GUILD_FORUM` (type 15) and `GUILD_MEDIA` (type 16) channels contain only threads, so harvest them entirely through the thread routes above; each post is a thread whose messages are fetched with the thread's ID
- **Forwarded messages** — a forward has `message_reference.type` `1` (`FORWARD`) and carries the forwarded message's data in `message_snapshots[].message`. Stage `attachments` and `embeds` from each snapshot under the same rules as top-level ones
- **Embed images** — an embed `image` or `thumbnail` has `url` (the source URL) and an optional `proxy_url` (a proxied URL of the image). Run `validate_url` on both and stage whichever passes as `download`; when neither passes, record the link with no downloaded image
- **Ephemeral messages** — some bot responses are ephemeral and won't appear in message history
- **Deleted messages** — if a message was deleted between listing and downloading, the CDN URL will 404

### CDN & Downloads
- **Expiring URLs** — Discord CDN attachment URLs contain authentication tokens that expire; download promptly after extraction
- **Large files** — Discord attachment limits vary by account, server plan, and policy changes; do not hard-code a size assumption. `curl` handles large downloads but they may take time
- **Duplicate content** — same image/link shared in multiple messages; deduplicate before downloading
- **OG:image availability** — only embed images Discord already supplied on an allowlisted CDN host are downloadable; record other links as having no downloaded image and never fetch the linked page to find one

### Staging & Flagged Content
- **Staging summary shows flagged items** — `flag_suspicious()` matched injection patterns or an executable/script extension in a filename or embed title. These are warnings, not blocks. Review the flagged items and proceed if they look benign (e.g., a file genuinely named "important_notes.pdf"). The flag is recorded in `manifest.json` for audit.
- **User declines at staging prompt** — no downloads happen. The staging data is discarded. Re-run with adjusted scope or content type filters.
- **Resolved IDs in manifest.json return errors on re-run** — the channel or thread was deleted or the bot lost access. Discard the stale ID from `resolvedIds` and re-resolve via API.

## Troubleshooting

### Bot Can't See the Channel
- A channel the bot cannot view is omitted from `GET /guilds/{guild.id}/channels` entirely (since 2026-11-16), so it looks like a missing channel
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

## API Sources

Discord facts this skill relies on, each checked against the cited page on 2026-11-21. Re-check a row before changing the behavior that depends on it, and whenever Discord's change log announces a change to channels, messages, threads, or rate limits.

| Fact | Source |
|---|---|
| API v10 is an available version; bot requests send `Authorization: Bot <token>`; attachment CDN URLs are signed (`ex`, `is`, `hm`) with a preset expiry; the CDN base is `https://cdn.discordapp.com/`; HTTP clients send `User-Agent: DiscordBot ($url, $versionNumber)`, and requests without a valid one may be blocked | https://docs.discord.com/developers/reference |
| HTTP 401 means the `Authorization` header was missing or invalid; 403 means the token lacks permission; 404 means the resource does not exist; 429 means rate limited | https://docs.discord.com/developers/topics/opcodes-and-status-codes |
| A 429 carries `Retry-After`; each bot has a global limit of 50 requests per second; 401, 403, and 429 responses count toward an invalid-request limit of 10,000 per 10 minutes per IP | https://docs.discord.com/developers/topics/rate-limits |
| `GET /channels/{channel.id}/messages` returns newest to oldest, `limit` 1–100 (default 50), with `before`, `after`, and `around` mutually exclusive; forwards use `message_reference.type` `1` with `message_snapshots`; embed images carry `url` and `proxy_url`; `content`, `embeds`, `attachments`, and `components` are empty without message-content access | https://docs.discord.com/developers/resources/message |
| Since 2026-11-16, `GET /guilds/{guild.id}/channels` omits channels the bot cannot view | https://docs.discord.com/developers/change-log and https://docs.discord.com/developers/resources/guild |
| `GUILD_FORUM` (15) and `GUILD_MEDIA` (16) channels contain only threads; archived-thread routes return `has_more`; the private archived route requires `MANAGE_THREADS` | https://docs.discord.com/developers/resources/channel |
| The user object's `bot` field marks an account that belongs to an OAuth2 application; `GET /users/@me` returns the requester's user object | https://docs.discord.com/developers/resources/user |
| Data Package request steps, delivery by emailed link within up to 30 days, and one request at a time | https://support.discord.com/hc/en-us/articles/360004027692-Requesting-a-Copy-of-your-Data |
| The package is a ZIP of JSON files; its Messages folder holds the messages the account sent; attachments appear as CDN links | https://support.discord.com/hc/en-us/articles/360004957991-Your-Discord-Data-Package |
| Automating a normal user account (a self-bot) outside the OAuth2/bot API is forbidden and can end in account termination | https://support.discord.com/hc/en-us/articles/115002192352-Automated-User-Accounts-Self-Bots |

Not stated on these pages, so unverified: the `images-ext-N.discordapp.net` hosts in the `validate_url` allowlist, and how long a signed CDN URL stays valid.
