import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const files = [
  'skills/discord-harvest/SKILL.md',
  'skills/discord-harvest/references/code-examples.md',
  'skills/discord-harvest/references/design-philosophy.md',
  'skills/discord-harvest/references/folder-structure.md',
  'skills/discord-harvest/references/troubleshooting.md',
];

const content = files.map((file) => readFileSync(file, 'utf8')).join('\n');

test('discord-harvest exposes only bot, Data Package, and manual local acquisition paths', () => {
  assert.match(content, /Discord Data Package/);
  assert.match(content, /manually exported local files|Manually exported local files/);
  assert.match(content, /bot API/);
  assert.match(content, /messages sent by the requesting account|Messages cover messages sent by the requesting account/);
});

test('discord-harvest does not ship logged-in Discord browser extraction instructions', () => {
  assert.doesNotMatch(content, /discord\.com\/channels\/@me/);
  assert.doesNotMatch(content, /browser_tool|cursor-ide-browser|browser_navigate|browser_snapshot/);
  assert.doesNotMatch(content, /querySelector(?:All)?\s*\(/);
  assert.doesNotMatch(content, /messageListItem|messageContent/);
});

test('discord-harvest keeps bot-token-only authentication when a request is rejected or a tool is unverified', () => {
  const skill = readFileSync('skills/discord-harvest/SKILL.md', 'utf8');
  const examples = readFileSync('skills/discord-harvest/references/code-examples.md', 'utf8');
  // A 401 must stop the run, never trigger a different auth scheme.
  assert.match(skill, /On HTTP 401, stop/);
  assert.match(skill, /never change the auth scheme \(no dropped `Bot ` prefix, `Bearer`, user token, or session cookie\)/);
  assert.match(examples, /\| 401 \|[^\n]*Stop all requests[^\n]*Never change the auth scheme/);
  // The only Authorization header the skill ever builds is the Bot scheme.
  const headers = [...content.matchAll(/Authorization: (\w+)/g)].map(m => m[1]);
  assert.ok(headers.length > 0 && headers.every(scheme => scheme === 'Bot'), `unexpected scheme in ${headers}`);
  // MCP servers need positive evidence of bot authentication; user-token servers stay refused.
  assert.match(skill, /use Discord MCP tools only with evidence that the server authenticates as a bot application/);
  assert.match(skill, /Refuse MCP servers that use a user token or self-bot session/);
  assert.match(content, /Do not add browser-DOM extraction, self-bot clients, or authenticated-session scraping as a fallback/);
});

test('discord-harvest frontmatter routes only to in-policy Discord asset archiving', () => {
  const skill = readFileSync('skills/discord-harvest/SKILL.md', 'utf8');
  const frontmatter = skill.match(/^---\n([\s\S]*?)\n---\n/)[1];
  const description = JSON.parse(frontmatter.match(/^description: (".*")$/m)[1]);
  assert.ok(description.length <= 1024, `description is ${description.length} characters`);
  assert.doesNotMatch(description, /[<>]/);
  // The acquisition boundary and the exclusions stay visible to the routing agent.
  assert.match(description, /bot application's API access/);
  assert.match(description, /never via user tokens, self-bots, or Discord Web automation/);
  assert.match(description, /Not for chat transcripts or message text/);
  // Every quoted trigger names Discord, so a bare "archive a DM" cannot route here.
  const triggers = [...description.matchAll(/"([^"]+)"/g)].map(m => m[1]);
  assert.ok(triggers.length >= 5);
  for (const trigger of triggers) assert.match(trigger, /Discord/, `unqualified trigger: ${trigger}`);
  // No retrieval cue advertises scraping; the body may still name it in refusals.
  assert.doesNotMatch(frontmatter, /scrap/i);
  // Tools the documented recipes need are declared.
  assert.match(frontmatter, /^compatibility: .*\bBash\b.*\bcurl\b/m);
});
