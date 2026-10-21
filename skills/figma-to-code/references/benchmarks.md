# Official Figma Skills Snapshot

Checked 2026-10-21 against [figma/mcp-server-guide `skills/`](https://github.com/figma/mcp-server-guide/tree/main/skills) at commit `056adaf7`. Refresh before a major revision of this skill; official names change.

| Official skill | Relation to `figma-to-code` |
|---|---|
| `figma-design-to-code` | Owns the implement procedure when installed; this skill supplies the conventions brief and correction loop |
| `figma-implement-motion`, `figma-swiftui` | Own motion and SwiftUI implementation; this skill supplies conventions |
| `figma-code-connect` | Owns `.figma.ts` templates and submission; this skill owns mapping decisions |
| `figma-use`, `figma-generate-design`, `figma-generate-library`, `figma-code-workflows`, `figma-create-new-file` | Figma-side writes and code-to-Figma; out of scope |
| `figma-use-figjam`, `figma-use-slides`, `figma-generate-diagram`, `figma-spec`, `figma-use-motion`, `figma-shaders`, `figma-generative-plugins` | Figma-side authoring; out of scope |

No official design-system-rules skill exists at this snapshot, so `/figma-to-code rules` remains this skill's. Names from the 2026-05 snapshot that no longer appear: `figma-implement-design`, `implement-design`, `figma-create-design-system-rules`, `create-design-system-rules`, `code-connect-components`.

## Refresh

1. List current names: `gh api repos/figma/mcp-server-guide/contents/skills --jq '.[].name'`.
2. Record the tip: `gh api 'repos/figma/mcp-server-guide/commits?per_page=1' --jq '.[0].sha[0:8]'`.
3. Update the table, the Skill Boundaries table in `SKILL.md`, and the official-skill routing case in `assets/evals/scenarios.json`.
