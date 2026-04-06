# Troubleshooting & Common Issues — Full Reference

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
- **Thread messages** — threads are separate channels in the API. After fetching the main channel, list active threads (`GET /channels/{id}/threads/active`) and archived threads (`GET /channels/{id}/threads/archived/public`). Fetch each thread's messages using the thread's channel ID. Attachments shared only in threads won't appear in the parent channel.
- **Ephemeral messages** — some bot responses are ephemeral and won't appear in message history
- **Deleted messages** — if a message was deleted between listing and downloading, the CDN URL will 404

### CDN & Downloads
- **Expiring URLs** — Discord CDN attachment URLs contain authentication tokens that expire; download promptly after extraction
- **Large files** — Discord attachments can be up to 25MB (500MB with Nitro); `curl` handles these but may take time
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
