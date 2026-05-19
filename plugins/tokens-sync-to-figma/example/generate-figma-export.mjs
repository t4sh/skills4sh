#!/usr/bin/env node
// Illustrative CI generator: turns a code-side token/layout description into
// the figma-export.json contract this plugin consumes. Adapt `loadLayout()`
// to your real token source (Style Dictionary build, theme module, etc.).
//
// Usage in CI:
//   node example/generate-figma-export.mjs > figma-export.json
//   gh gist edit <GIST_ID> -f figma-export.json
//
// The plugin only needs the { meta, sections[] } shape — where the section
// list comes from is your repo's concern, not the plugin's.

import { writeSync } from "node:fs";

// Replace this with a read of your real layout/token map.
function loadLayout() {
  return [
    {
      id: "hero",
      name: "Hero",
      bgToken: "color/bg/default",
      nodes: [
        {
          text: "Ship tokens, not screenshots",
          fontFamilyToken: "font/family/display",
          fontSizeToken: "font/size/2xl",
          letterSpacingToken: "font/tracking/tight",
          colorToken: "color/text/strong",
        },
      ],
    },
  ];
}

const exportData = {
  meta: { generated: new Date().toISOString() },
  sections: loadLayout(),
};

writeSync(1, JSON.stringify(exportData, null, 2) + "\n");
