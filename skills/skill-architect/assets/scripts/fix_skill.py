#!/usr/bin/env python3
"""Apply conservative, deterministic fixes to one portable agent skill folder.

Default mode is dry-run. Pass --write to modify SKILL.md. This helper only
fixes facts visible inside one skill folder and intentionally avoids judgment
rewrites such as improving descriptions, splitting sections, or guessing broken
anchors.
"""

from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass
from pathlib import Path


@dataclass
class Edit:
    label: str
    before: str
    after: str


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return re.sub(r"-{2,}", "-", slug)


def parse_frontmatter_block(text: str) -> tuple[str | None, int, int]:
    match = re.match(r"^---\n([\s\S]*?)\n---\n?", text)
    if not match:
        return None, 0, 0
    return match.group(1), match.start(1), match.end(1)


def linked_reference_paths(skill_md: str) -> set[str]:
    stripped = re.sub(r"^```[\s\S]*?^```", "", skill_md, flags=re.M)
    stripped = re.sub(r"`[^`\n]*`", "", stripped)
    return set(re.findall(r"!?\[[^\]]*\]\((references/[^)#?\s]+)", stripped))


def format_reference_label(path: str) -> str:
    stem = Path(path).stem.replace("-", " ").replace("_", " ").strip()
    return stem.title() if stem else path


def reference_row(path: str) -> str:
    return f"| [{path}]({path}) | Load when this reference is needed |"


def is_ignored_artifact(path: Path) -> bool:
    return path.name == ".DS_Store" or path.name.endswith(".pyc") or "__pycache__" in path.parts


def ensure_reference_links(body: str, missing_refs: list[str]) -> tuple[str, list[Edit]]:
    if not missing_refs:
        return body, []

    edits: list[Edit] = []
    rows = "\n".join(reference_row(ref) for ref in missing_refs)

    # Prefer appending rows to an existing Markdown table directly under a
    # Reference files / Reference Files section.
    section = re.search(r"(?im)^## Reference files\s*$", body)
    if section:
        next_heading = re.search(r"(?m)^## ", body[section.end():])
        section_end = section.end() + (next_heading.start() if next_heading else len(body[section.end():]))
        section_text = body[section.end():section_end]
        table_rows = list(re.finditer(r"(?m)^\|.*\|\s*$", section_text))
        if table_rows:
            insert_at = section.end() + table_rows[-1].end()
            after = body[:insert_at] + "\n" + rows + body[insert_at:]
            edits.append(Edit("append missing reference table rows", body, after))
            return after, edits

        addition = "\n\n| File | Load when |\n|---|---|\n" + rows + "\n"
        after = body[:section.end()] + addition + body[section.end():]
        edits.append(Edit("create reference table in existing section", body, after))
        return after, edits

    addition = "\n\n## Reference files\n\n| File | Load when |\n|---|---|\n" + rows + "\n"
    after = body.rstrip() + addition + "\n"
    edits.append(Edit("add Reference files section", body, after))
    return after, edits


def fix_skill(skill_dir: Path) -> tuple[str, list[Edit]]:
    skill_md = skill_dir / "SKILL.md"
    if not skill_md.exists():
        raise SystemExit(f"missing SKILL.md: {skill_md}")

    text = skill_md.read_text(encoding="utf-8")
    edits: list[Edit] = []

    frontmatter, fm_start, fm_end = parse_frontmatter_block(text)
    if frontmatter is not None:
        lines = frontmatter.splitlines()
        name_line_idx = next((i for i, line in enumerate(lines) if re.match(r"^name:\s*", line)), None)
        expected_name = skill_dir.name
        if name_line_idx is None:
            lines.insert(0, f"name: {expected_name}")
            next_frontmatter = "\n".join(lines)
            next_text = text[:fm_start] + next_frontmatter + text[fm_end:]
            edits.append(Edit("add missing frontmatter name", text, next_text))
            text = next_text
        else:
            current = lines[name_line_idx].split(":", 1)[1].strip().strip('"\'')
            normalized = slugify(current) or expected_name
            replacement = expected_name if normalized != expected_name else normalized
            if current != replacement:
                old_text = text
                lines[name_line_idx] = f"name: {replacement}"
                next_frontmatter = "\n".join(lines)
                text = text[:fm_start] + next_frontmatter + text[fm_end:]
                edits.append(Edit(f"normalize frontmatter name {current!r} -> {replacement!r}", old_text, text))

    files = {
        str(path.relative_to(skill_dir)).replace("\\", "/")
        for path in skill_dir.rglob("*")
        if path.is_file() and not is_ignored_artifact(path)
    }
    reference_files = sorted(path for path in files if path.startswith("references/") and path.endswith(".md"))
    missing_refs = [ref for ref in reference_files if ref not in linked_reference_paths(text)]
    if missing_refs:
        old_text = text
        text, ref_edits = ensure_reference_links(text, missing_refs)
        if ref_edits:
            edits.append(Edit(f"link missing references: {', '.join(missing_refs)}", old_text, text))

    return text, edits


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("skill_dir", type=Path)
    parser.add_argument("--write", action="store_true", help="write fixes to SKILL.md; default is dry-run")
    args = parser.parse_args()

    next_text, edits = fix_skill(args.skill_dir)
    if not edits:
        print("✓ no deterministic fixes available")
        return 0

    for edit in edits:
        print(f"• {edit.label}")

    if args.write:
        (args.skill_dir / "SKILL.md").write_text(next_text, encoding="utf-8")
        print(f"✓ wrote {(args.skill_dir / 'SKILL.md')}")
    else:
        print("dry-run only; pass --write to modify SKILL.md")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
