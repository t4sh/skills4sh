#!/usr/bin/env python3
"""Validate a portable agent skill folder with conservative checks.

Hard failures cover portable structural requirements. Warning-only hints flag
judgment calls, such as substantial duplicated sections that may belong in
references under progressive disclosure.
"""

from __future__ import annotations

import argparse
import posixpath
import re
from pathlib import Path
from urllib.parse import unquote

MAX_BODY_WORDS = 3500
DUPLICATE_SECTION_WORDS = 75
REQUIRED_TOP = {"name", "description"}


def unquote_scalar(value: str) -> str:
    """Remove one layer of matching surrounding quotes and unescape the body.

    Quotes are handled as a single matched pair so an already-escaped value such
    as ``\\"create X\\"`` is not mangled into doubled backslashes.
    """
    value = value.strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
        inner = value[1:-1]
        if value[0] == '"':
            return inner.replace('\\"', '"').replace("\\\\", "\\")
        return inner.replace("''", "'")
    return value


def parse_frontmatter(text: str) -> tuple[dict[str, str], int] | tuple[None, int]:
    match = re.match(r"^---\n([\s\S]*?)\n---\n?", text)
    if not match:
        return None, 0
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
    return fields, match.end()


def strip_code_fences(text: str) -> str:
    return re.sub(r"^```[\s\S]*?^```", "", text, flags=re.M)


def strip_all_code(text: str) -> str:
    """Strip fenced blocks and inline code so link scanning ignores samples."""
    return re.sub(r"`[^`\n]*`", "", strip_code_fences(text))


def github_slug(heading: str) -> str:
    """Approximate GitHub heading slug: lowercase, drop punctuation, spaces -> hyphens."""
    slug = heading.strip().lower()
    slug = re.sub(r"[^\w\s-]", "", slug)
    return re.sub(r"\s", "-", slug)


def heading_anchors(text: str) -> set[str]:
    """Slugs for every ATX heading, with GitHub-style duplicate disambiguation."""
    anchors: set[str] = set()
    seen: dict[str, int] = {}
    stripped = strip_code_fences(text)
    for match in re.finditer(r"^#{1,6}\s+(.+?)\s*#*\s*$", stripped, re.M):
        base = github_slug(match.group(1))
        if not base:
            continue
        count = seen.get(base, 0)
        seen[base] = count + 1
        anchors.add(base if count == 0 else f"{base}-{count}")
    return anchors


def markdown_link_targets(text: str) -> list[str]:
    stripped = strip_all_code(text)
    return [m.group(1) for m in re.finditer(r"!?\[[^\]]*\]\(([^)\s]+)(?:\s+\"[^\"]*\")?\)", stripped)]


def split_link_target(target: str) -> tuple[str, str]:
    hash_idx = target.find("#")
    query_idx = target.find("?")
    ends = [i for i in (hash_idx, query_idx) if i != -1]
    path_only = target if not ends else target[: min(ends)]
    anchor = "" if hash_idx == -1 else target[hash_idx + 1 :].split("?", 1)[0]
    return path_only, anchor


def has_trigger_clause(description: str) -> bool:
    return bool(
        re.search(r"(^|\.\s+)use when\b", description, re.I)
        or re.search(r"\bshould be used when\b", description, re.I)
        or re.search(r"\bused when\b", description, re.I)
        or re.search(r"\bwhen the user\b", description, re.I)
        or re.search(r"\bwhen working\b", description, re.I)
        or re.search(r"\bwhen paths? include\b", description, re.I)
        or re.search(r"\bor mentions\b", description, re.I)
    )


def has_concrete_trigger_detail(description: str) -> bool:
    """Return true when a trigger clause includes concrete retrieval cues."""
    separators = len(re.findall(r",|;|\bor\b", description, re.I))
    return bool(
        re.search(r'"[^"\n]{3,}"', description)
        or re.search(r"`[^`\n]+`", description)
        or re.search(r"\b[\w.-]+\.(?:md|mdx|js|mjs|cjs|ts|tsx|jsx|py|json|ya?ml|toml|njk|html|css)\b", description, re.I)
        or re.search(r"\bwhen paths? include\b|\bor mentions\b|\bwhen debugging\b|\bwhen working on\b", description, re.I)
        or (separators >= 2 and len(re.findall(r"\b\S+\b", description)) >= 12)
    )


def iter_sections(markdown: str) -> list[tuple[str, str]]:
    """Return top-level markdown sections as (heading, body) pairs."""
    lines = markdown.splitlines()
    sections: list[tuple[str, list[str]]] = []
    current_heading: str | None = None
    current_body: list[str] = []

    for line in lines:
        if line.startswith("## "):
            if current_heading is not None:
                sections.append((current_heading, current_body))
            current_heading = line.strip()
            current_body = []
        elif current_heading is not None:
            current_body.append(line)

    if current_heading is not None:
        sections.append((current_heading, current_body))

    return [(heading, "\n".join(body)) for heading, body in sections]


def word_count(text: str) -> int:
    """Count words after stripping code fences (used for duplicate-section hints)."""
    return len(re.findall(r"\b\S+\b", strip_code_fences(text)))


def body_word_count(text: str) -> int:
    """Count body words exactly as the repo CI body-size gate does (raw body).

    The CI checker counts the trimmed body without stripping code fences, so the
    portable cap check must match it to avoid disagreeing on the same threshold.
    """
    return len(re.findall(r"\b\S+\b", text.strip()))


def is_ignored_artifact(path: Path) -> bool:
    return path.name == ".DS_Store" or path.name.endswith(".pyc") or "__pycache__" in path.parts


def progressive_disclosure_warnings(skill_dir: Path, skill_text: str, files: set[str]) -> list[str]:
    """Warn when SKILL.md substantially duplicates a reference section."""
    warnings: list[str] = []
    skill_sections = {
        heading: body
        for heading, body in iter_sections(skill_text)
        if word_count(body) >= DUPLICATE_SECTION_WORDS
    }
    if not skill_sections:
        return warnings

    for ref in sorted(path for path in files if path.startswith("references/") and path.endswith(".md")):
        ref_text = (skill_dir / ref).read_text(encoding="utf-8")
        for heading, body in iter_sections(ref_text):
            if heading in skill_sections and word_count(body) >= DUPLICATE_SECTION_WORDS:
                warnings.append(
                    f"substantial duplicate section {heading!r} appears in SKILL.md and {ref}; "
                    "consider keeping SKILL.md as a routing summary and making the reference canonical"
                )
    return warnings


def validate(skill_dir: Path) -> list[str]:
    errors: list[str] = []
    skill_md = skill_dir / "SKILL.md"
    if not skill_md.exists():
        return ["missing SKILL.md"]
    text = skill_md.read_text(encoding="utf-8")
    frontmatter, body_start = parse_frontmatter(text)
    if frontmatter is None:
        return ["missing YAML frontmatter"]

    missing = REQUIRED_TOP - set(frontmatter)
    for field in sorted(missing):
        errors.append(f"missing frontmatter field: {field}")

    name = frontmatter.get("name", "")
    if name and name != skill_dir.name:
        errors.append(f"frontmatter name {name!r} does not match directory {skill_dir.name!r}")
    if name and not re.match(r"^[a-z0-9-]+$", name):
        errors.append(f"name {name!r} must be lowercase kebab-case")

    description = frontmatter.get("description", "")
    if description and not has_trigger_clause(description):
        errors.append("description should include concrete trigger/use conditions, e.g. 'Capability. Use when ...' or 'Use when ...'")
    elif description and not has_concrete_trigger_detail(description):
        errors.append("description trigger/use conditions are too generic; include a quoted user phrase, path/file cue, tool cue, named situation, or multi-clause trigger")

    body_words = body_word_count(text[body_start:])
    if body_words > MAX_BODY_WORDS:
        errors.append(f"body has {body_words} words; maximum is {MAX_BODY_WORDS}")

    files = {
        str(path.relative_to(skill_dir)).replace("\\", "/")
        for path in skill_dir.rglob("*")
        if path.is_file() and not is_ignored_artifact(path)
    }
    skill_body_no_code = strip_code_fences(text)
    linked = set(re.findall(r"!?\[[^\]]*\]\((references/[^)#\s]+)", skill_body_no_code))
    for ref in sorted(path for path in files if path.startswith("references/") and path.endswith(".md")):
        if ref not in linked:
            errors.append(f"reference file is not linked from SKILL.md: {ref}")

    errors.extend(validate_markdown_links(skill_dir, files))

    return errors


def validate_markdown_links(skill_dir: Path, files: set[str]) -> list[str]:
    """Validate in-skill relative markdown links and markdown heading anchors."""
    errors: list[str] = []
    anchor_cache: dict[str, set[str]] = {}

    def anchors_for(rel: str) -> set[str]:
        if rel not in anchor_cache:
            anchor_cache[rel] = heading_anchors((skill_dir / rel).read_text(encoding="utf-8"))
        return anchor_cache[rel]

    for rel in sorted(p for p in files if p.endswith(".md")):
        md_text = (skill_dir / rel).read_text(encoding="utf-8")
        for target in markdown_link_targets(md_text):
            if re.match(r"^[a-z][a-z0-9+.-]*:", target, re.I) or target.startswith("//"):
                continue

            path_only, anchor = split_link_target(target)
            resolved = posixpath.normpath(posixpath.join(posixpath.dirname(rel), path_only)) if path_only else rel
            if resolved.startswith("..") or resolved.startswith("/"):
                errors.append(f"{rel} links outside skill folder: {target}")
                continue
            if resolved not in files:
                errors.append(f"{rel} links missing in-skill target: {target} (resolves to {resolved})")
                continue
            if anchor and resolved.endswith(".md") and unquote(anchor) not in anchors_for(resolved):
                errors.append(f"{rel} links broken anchor #{unquote(anchor)} (not a heading in {resolved})")

    return errors


def validate_with_warnings(skill_dir: Path) -> tuple[list[str], list[str]]:
    errors = validate(skill_dir)
    if errors:
        return errors, []

    skill_md = skill_dir / "SKILL.md"
    text = skill_md.read_text(encoding="utf-8")
    files = {
        str(path.relative_to(skill_dir)).replace("\\", "/")
        for path in skill_dir.rglob("*")
        if path.is_file() and not is_ignored_artifact(path)
    }
    return [], progressive_disclosure_warnings(skill_dir, text, files)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("skill_dir", type=Path)
    args = parser.parse_args()
    errors, warnings = validate_with_warnings(args.skill_dir)
    if errors:
        for error in errors:
            print(f"✗ {error}")
        return 1
    print("✓ skill validation passed")
    for warning in warnings:
        print(f"⚠ {warning}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
