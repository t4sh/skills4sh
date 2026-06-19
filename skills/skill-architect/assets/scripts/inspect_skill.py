#!/usr/bin/env python3
"""Summarize a local agent skill folder without modifying it."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path


def unquote_scalar(value: str) -> str:
    """Remove one layer of matching surrounding quotes and unescape the body.

    Uses ``.strip()`` only for surrounding whitespace; quotes are handled as a
    single matched pair so an already-escaped value such as ``\\"create X\\"`` is
    not mangled into doubled backslashes.
    """
    value = value.strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
        inner = value[1:-1]
        if value[0] == '"':
            return inner.replace('\\"', '"').replace("\\\\", "\\")
        return inner.replace("''", "'")
    return value


def parse_frontmatter(text: str) -> tuple[dict[str, str], str]:
    match = re.match(r"^---\n([\s\S]*?)\n---\n?", text)
    if not match:
        return {}, text
    fields: dict[str, str] = {}
    in_metadata = False
    for raw in match.group(1).splitlines():
        if not raw.strip() or raw.lstrip().startswith("#"):
            continue
        top = re.match(r"^([A-Za-z0-9_-]+):\s*(.*)$", raw)
        if top:
            key, value = top.groups()
            fields[key] = unquote_scalar(value)
            in_metadata = key == "metadata"
            continue
        nested = re.match(r"^\s+([A-Za-z0-9_-]+):\s*(.*)$", raw)
        if nested and in_metadata:
            key, value = nested.groups()
            fields[f"metadata.{key}"] = unquote_scalar(value)
    return fields, text[match.end() :]


def markdown_links(text: str) -> list[str]:
    stripped = re.sub(r"^```[\s\S]*?^```", "", text, flags=re.M)
    return re.findall(r"!?\[[^\]]*\]\(([^)\s]+)", stripped)


def is_ignored_artifact(path: Path) -> bool:
    return path.name == ".DS_Store" or path.name.endswith(".pyc") or "__pycache__" in path.parts


def inspect(skill_dir: Path) -> dict[str, object]:
    skill_md = skill_dir / "SKILL.md"
    text = skill_md.read_text(encoding="utf-8") if skill_md.exists() else ""
    frontmatter, body = parse_frontmatter(text)
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
        "version": frontmatter.get("metadata.version"),
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
    print(json.dumps(inspect(args.skill_dir), indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
