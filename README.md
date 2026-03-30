# skills4sh

Agent skills for Claude Code, Cursor, Windsurf, Cline, and other AI coding agents.

## Skills

| Skill | Description | Version |
|-------|-------------|---------|
| [agent-memory](skills/agent-memory/) | Cross-interface persistent memory system for any project | 2.2 |
| [discord-harvest](skills/discord-harvest/) | Extract and download images, links, and files from Discord conversations | 1.0.0 |
| [localhost-screenshots](skills/localhost-screenshots/) | Localhost screenshot capture and visual regression testing | 1.0.0 |

## Install

### Via `npx skills` (recommended)

```bash
# List available skills
npx skills add t4sh/skills4sh --list

# Install a specific skill
npx skills add t4sh/skills4sh --skill agent-memory

# Install all skills
npx skills add t4sh/skills4sh --all
```

### Manual install

Each skill includes cross-platform install scripts:

```bash
# Clone the repo
git clone https://github.com/t4sh/skills4sh.git
cd skills4sh/skills/agent-memory

# macOS / Linux
./install.sh

# Windows (PowerShell)
.\install.ps1
```

The install scripts prompt for:
1. **Global** (`~/.claude/skills/<skill>/`) or **Project** (`./.claude/skills/<skill>/`) install
2. Credential setup (for skills that need it)

---

## Install from GitHub (private repo)

**Option A: Use HTTPS URL** (works with your existing `gh` auth):

```bash
npx skills add https://github.com/t4sh/skills4sh --skill agent-memory
```

**Option B: Use SSH URL:**

```bash
npx skills add git@github.com:t4sh/skills4sh.git --skill agent-memory
```

> **Note:** If SSH fails with `Permission denied (publickey)`, configure git to rewrite SSH → HTTPS:
>
> ```bash
> git config --global url."https://github.com/".insteadOf "git@github.com:"
> ```
>
> This lets SSH-style URLs transparently use your `gh` CLI token.

## Skill structure

Each skill follows the [Agent Skills specification](https://agentskills.io/specification):

```
skills/<skill-name>/
├── SKILL.md          # Required: metadata + instructions
├── install.sh        # Bash installer (macOS/Linux)
├── install.ps1       # PowerShell installer (Windows)
└── [supporting files]
```

## License

MIT
