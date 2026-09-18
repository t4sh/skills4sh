#!/usr/bin/env python3
"""Run uv without inherited UV_* host configuration."""

from __future__ import annotations

import os
import sys
from collections.abc import Mapping


def clean_uv_environment(source: Mapping[str, str]) -> dict[str, str]:
    """Copy an environment while removing uv's case-insensitive namespace."""
    return {key: value for key, value in source.items() if not key.upper().startswith("UV_")}


def main(args: list[str] | None = None) -> int:
    uv_args = sys.argv[1:] if args is None else args
    if not uv_args:
        print("usage: run_uv.py <uv arguments...>", file=sys.stderr)
        return 2

    try:
        os.execvpe("uv", ["uv", *uv_args], clean_uv_environment(os.environ))
    except OSError as exc:
        print(f"unable to execute uv: {exc}", file=sys.stderr)
        return 127
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
