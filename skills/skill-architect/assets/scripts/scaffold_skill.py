#!/usr/bin/env python3
"""Create a starter portable skill folder using the skill-architect rubric."""

from __future__ import annotations

import argparse
import re
from pathlib import Path

TEMPLATE = """---
name: {slug}
description: {description}
license: MIT
compatibility: macOS, Linux, or Windows
metadata:
{author_line}  version: "0.1.0"
  tags: {tags}
---

# {title}

One-paragraph purpose statement. Explain what repeated task this skill makes reliable.

## When this skill applies

- Keep the frontmatter description concrete; replace scaffold defaults with exact request phrases before release.
- Add file-path or tool cues.
- Add false-friend cases if important.

## Operating procedure

1. Classify the request into this skill's branches before editing; replace this step with the real branch list.
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

OPENAI_YAML = """interface:
  display_name: {display_name}
  short_description: {short_description}
  default_prompt: {default_prompt}
policy:
  allow_implicit_invocation: true
"""


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return re.sub(r"-{2,}", "-", slug)


def titleize(slug: str) -> str:
    return " ".join(part.capitalize() for part in slug.split("-"))


def yaml_double_quoted(value: str) -> str:
    """Emit value as a valid YAML double-quoted scalar.

    Escapes backslashes and double quotes so an interpolated trigger phrase
    cannot break the scalar or inject extra frontmatter keys.
    """
    escaped = value.replace("\\", "\\\\").replace('"', '\\"')
    return f'"{escaped}"'


def openai_short_description(title: str) -> str:
    """Return a Codex short_description within the documented 25-64 characters."""
    text = f"Repeatable {title} procedures and checks"
    if len(text) <= 64:
        return text
    trimmed = text[:64].rsplit(" ", 1)[0]
    return trimmed if len(trimmed) >= 25 else text[:64]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("name", help="Skill name or slug")
    parser.add_argument("--path", type=Path, default=Path("skills"), help="Directory that will contain the new skill folder")
    parser.add_argument("--phrase", default="work with this skill", help="Example trigger phrase")
    parser.add_argument("--tags", default="agent-skills, workflow", help="Comma-separated metadata tags")
    parser.add_argument("--author", help="metadata.author value; omitted from frontmatter when not given")
    parser.add_argument("--openai-yaml", action="store_true", help="Also write an agents/openai.yaml Codex adapter")
    args = parser.parse_args()

    slug = slugify(args.name)
    if not slug:
        raise SystemExit("skill name produced an empty slug")

    title = titleize(slug)
    description_text = (
        f'{title} workflow support. Use when asked to "{args.phrase}", '
        f"requests repeatable {title} guidance, or needs {slug} procedures, checks, or handoffs."
    )

    skill_dir = args.path / slug
    skill_dir.mkdir(parents=True, exist_ok=False)
    (skill_dir / "SKILL.md").write_text(
        TEMPLATE.format(
            slug=slug,
            title=title,
            description=yaml_double_quoted(description_text),
            tags=args.tags,
            author_line=f"  author: {yaml_double_quoted(args.author)}\n" if args.author else "",
        ),
        encoding="utf-8",
    )
    if args.openai_yaml:
        (skill_dir / "agents").mkdir()
        (skill_dir / "agents" / "openai.yaml").write_text(
            OPENAI_YAML.format(
                display_name=yaml_double_quoted(title),
                short_description=yaml_double_quoted(openai_short_description(title)),
                default_prompt=yaml_double_quoted(f"Use ${slug} to {args.phrase}."),
            ),
            encoding="utf-8",
        )
    print(f"created {skill_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
