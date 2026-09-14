#!/usr/bin/env python3
"""Summarize a local agent skill folder without modifying it."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path


from validate_skill import parse_frontmatter


def markdown_links(text: str) -> list[str]:
    stripped = re.sub(r"^```[\s\S]*?^```", "", text, flags=re.M)
    return re.findall(r"!?\[[^\]]*\]\(([^)\s]+)", stripped)


def is_ignored_artifact(path: Path) -> bool:
    return path.name == ".DS_Store" or path.name.endswith(".pyc") or "__pycache__" in path.parts


def inspect(skill_dir: Path) -> dict[str, object]:
    skill_md = skill_dir / "SKILL.md"
    text = skill_md.read_text(encoding="utf-8") if skill_md.exists() else ""
    frontmatter, body_start = parse_frontmatter(text)
    frontmatter = frontmatter or {}
    body = text[body_start:]
    files = sorted(
        str(path.relative_to(skill_dir)).replace("\\", "/")
        for path in skill_dir.rglob("*")
        if path.is_file() and not is_ignored_artifact(path)
    )
    references = [item for item in files if item.startswith("references/")]
    links = markdown_links(text)
    return {
        "skill_dir": str(skill_dir),
        "name": frontmatter.get("name"),
        "description": frontmatter.get("description"),
        "version": frontmatter.get("metadata", {}).get("version"),
        "body_words": len(re.findall(r"\b\S+\b", body)),
        "file_count": len(files),
        "files": files,
        "references": references,
        "links": links,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("skill_dir", type=Path)
    args = parser.parse_args()
    try:
        print(json.dumps(inspect(args.skill_dir), indent=2, sort_keys=True))
    except ValueError as exc:
        parser.exit(1, f"invalid skill: {exc}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
