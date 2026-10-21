# Helper runtime

Use this reference before running `inspect_skill.py` or `validate_skill.py`. Scaffold and fix helpers need only Python >=3.10 and can run with `python3 -E -B` directly.

## Runner rules

- Validation and inspection need Python >=3.10 plus the version-and-hash-pinned [Python dependency file](../assets/scripts/requirements.txt). Use an isolated runner; never install validation dependencies into the global Python environment.
- Run every helper with `python -E -B`. `-E` stops `PYTHONPATH` from replacing pinned PyYAML; `-B` stops Python from writing `__pycache__/` into the installed skill folder. `-E` also ignores `PYTHONDONTWRITEBYTECODE`, so `-B` must be explicit.
- Do not use `python -I`; it drops the script directory from `sys.path` and breaks `inspect_skill.py`'s sibling import of `validate_skill.py`.

## Preferred: uv

Prefer `uv` when it is available. It is the preferred adapter, not a portable requirement. Invoke it through `run_uv.py`, which removes the entire inherited `UV_*` namespace before `uv` starts; `--no-config` only ignores persistent files and does not neutralize variables such as `UV_INDEX` or `UV_NO_VERIFY_HASHES`. `--isolated` alone still installs a surrounding project: add `--no-project` so a nearby `pyproject.toml` is not built or imported, `--no-build` so only wheels are used (the same pin as `pip install --only-binary=:all:`), and `--no-config` so host `uv.toml` / `uv.ini` is ignored.

```bash
python3 -E -B "/path/to/skill-architect/assets/scripts/run_uv.py" run --isolated --no-project --no-build --no-config --with-requirements "/path/to/skill-architect/assets/scripts/requirements.txt" python -E -B \
  "/path/to/skill-architect/assets/scripts/inspect_skill.py" "/path/to/target-skill"
python3 -E -B "/path/to/skill-architect/assets/scripts/run_uv.py" run --isolated --no-project --no-build --no-config --with-requirements "/path/to/skill-architect/assets/scripts/requirements.txt" python -E -B \
  "/path/to/skill-architect/assets/scripts/validate_skill.py" "/path/to/target-skill"
```

On Windows, use `py -3 -E -B` instead of `python3 -E -B` for the launcher command.

## Fallback: temporary virtual environment

If `uv` is unavailable or cannot prepare its isolated environment, fall back to a temporary virtual environment. On macOS or Linux:

```bash
VALIDATION_VENV="$(mktemp -d)/venv"
python3 -E -m venv "$VALIDATION_VENV"
"$VALIDATION_VENV/bin/python" -E -m pip --isolated install --require-hashes --only-binary=:all: \
  -r "/path/to/skill-architect/assets/scripts/requirements.txt"
"$VALIDATION_VENV/bin/python" -E -B "/path/to/skill-architect/assets/scripts/inspect_skill.py" "/path/to/target-skill"
"$VALIDATION_VENV/bin/python" -E -B "/path/to/skill-architect/assets/scripts/validate_skill.py" "/path/to/target-skill"
```

On Windows PowerShell:

```powershell
$ValidationVenv = Join-Path ([System.IO.Path]::GetTempPath()) ([guid]::NewGuid().ToString())
py -3 -E -m venv $ValidationVenv
& "$ValidationVenv\Scripts\python.exe" -E -m pip --isolated install --require-hashes --only-binary=:all: `
  -r "/path/to/skill-architect/assets/scripts/requirements.txt"
& "$ValidationVenv\Scripts\python.exe" -E -B "/path/to/skill-architect/assets/scripts/inspect_skill.py" "/path/to/target-skill"
& "$ValidationVenv\Scripts\python.exe" -E -B "/path/to/skill-architect/assets/scripts/validate_skill.py" "/path/to/target-skill"
```

## Availability reporting

A helper that starts and reports findings produced an available result, even when validation exits non-zero. Retry with the temporary-environment fallback only when `uv`, dependency resolution, or helper startup fails. Report validation or inspection as unavailable only after both isolated runner paths are unavailable or fail; name the attempted commands and setup errors. Do not silently substitute shape checks for YAML validation.
