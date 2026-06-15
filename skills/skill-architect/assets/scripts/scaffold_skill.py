#!/usr/bin/env python3
"""Create a starter portable skill folder using the skill-architect rubric."""

from __future__ import annotations

import argparse
import re
from pathlib import Path

TEMPLATE = """---
name: {slug}
description: "{title} workflow support. Use when the user asks to \"{phrase}\", requests repeatable {title} guidance, or needs {slug} procedures, checks, or handoffs."
license: MIT
compatibility: macOS, Linux, or Windows
metadata:
  author: t4sh
  version: "0.1.0"
  tags: {tags}
---

# {title}

One-paragraph purpose statement. Explain what repeated task this skill makes reliable.

## When this skill applies

- Keep the frontmatter description concrete; replace scaffold defaults with exact user phrases before release.
- Add file-path or tool cues.
- Add false-friend cases if important.

## Operating procedure

1. Classify the request path before editing (`plan`, `create`, `audit`, `fix`, `refactor`, `compare`, `distill`, `reconcile`, or `teach`).
2. Read the project-specific instructions and the files that define the task.
3. Choose the narrow workflow path.
4. Apply the skill's reusable guidance.
5. If handing work to another agent/session, include exact paths, checks, done criteria, and STOP conditions.
6. Verify the behavior touched.

## Reference files

Add linked references only when details would bloat `SKILL.md`.

## Non-negotiables

- Keep the portable core vendor-neutral.
- Keep references linked from `SKILL.md`.
- Report exact checks run.
"""


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return re.sub(r"-{2,}", "-", slug)


def titleize(slug: str) -> str:
    return " ".join(part.capitalize() for part in slug.split("-"))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("name", help="Skill name or slug")
    parser.add_argument("--path", type=Path, default=Path("skills"), help="Directory that will contain the new skill folder")
    parser.add_argument("--phrase", default="work with this skill", help="Example trigger phrase")
    parser.add_argument("--tags", default="agent-skills, workflow", help="Comma-separated metadata tags")
    args = parser.parse_args()

    slug = slugify(args.name)
    if not slug:
        raise SystemExit("skill name produced an empty slug")

    skill_dir = args.path / slug
    skill_dir.mkdir(parents=True, exist_ok=False)
    (skill_dir / "SKILL.md").write_text(
        TEMPLATE.format(slug=slug, title=titleize(slug), phrase=args.phrase, tags=args.tags),
        encoding="utf-8",
    )
    print(f"created {skill_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
