import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const files = [
  'skills/discord-harvest/SKILL.md',
  'skills/discord-harvest/references/code-examples.md',
  'skills/discord-harvest/references/design-philosophy.md',
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
