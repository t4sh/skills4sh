# Helper runtime

Use this reference before running `inspect_skill.py` or `validate_skill.py`. Scaffold and fix helpers need only Python >=3.10 and can run with `python3 -E -B` directly.

Read or run scripts only when the task needs deterministic inspection or scaffolding. Local validation commands and CI, when present, remain the source of truth.

## Helper limits

- `inspect_skill.py` and `validate_skill.py` each accept **one skill folder per invocation**. For multiple skills, invoke each helper once per folder in the same Python environment.
- The fixer accepts column-zero literal mapping keys and simple single-line literal names; it refuses unsupported key or name syntax before any edits. Review those cases manually, then validate.
- The fixer does not validate; run `validate_skill.py` after it.

## Runner rules

- Validation and inspection need Python 3.10–3.14 plus the version-and-hash-pinned [Python dependency file](../assets/scripts/requirements.txt). Use an isolated runner: `run_uv.py` first, a temporary virtual environment as fallback. Never install validation dependencies into the global Python environment.
- The upper bound comes from the pin: PyYAML 6.0.3 publishes wheels for CPython 3.8 through 3.14 only ([PyPI](https://pypi.org/project/PyYAML/6.0.3/#files), checked 2026-11-21), and both runners refuse source builds. On a newer interpreter the install stops with `No matching distribution found` (pip) or `no usable wheels` (uv); follow [Interpreter selection](#interpreter-selection) instead of changing the pin or allowing a build.
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

## Interpreter selection

Each runner picks its own interpreter, so the default can fall outside 3.10–3.14 even when a supported one is installed. Name a supported interpreter explicitly; every other argument stays as documented above.

| Runner | Check | When the default is unsupported |
|---|---|---|
| uv | The run stops before the helper starts with `pyyaml==6.0.3 has no usable wheels` | Insert `--python 3.14` (or any minor from 3.10 to 3.14) directly after `run`: `run_uv.py" run --python 3.14 --isolated --no-project --no-build --no-config --with-requirements ...` |
| venv, macOS or Linux | `python3 --version` | Create the environment with a versioned interpreter: `python3.14 -E -m venv "$VALIDATION_VENV"` |
| venv, Windows | `py -3 --version` (`py --list` shows installed versions) | `py -3.14 -E -m venv $ValidationVenv` |

By default uv downloads a managed interpreter when the requested version is not installed ([uv Python versions](https://docs.astral.sh/uv/concepts/python-versions/), checked 2026-11-21). Where downloads are not allowed, add `--no-python-downloads` after `run`; uv then fails with `No interpreter found` instead of fetching one.

Done when the runner's interpreter reports a version from 3.10 to 3.14 and `import yaml` succeeds in it, or no such interpreter can be selected and that is reported under [Availability reporting](#availability-reporting).

## Availability reporting

A helper that starts and reports findings produced an available result, even when validation exits non-zero. Retry with the temporary-environment fallback only when `uv`, dependency resolution, or helper startup fails. An interpreter outside 3.10–3.14 is a setup failure, not a validation result: apply [Interpreter selection](#interpreter-selection) and retry that runner first. Report validation or inspection as unavailable only after both isolated runner paths are unavailable or fail; name the attempted commands and setup errors, including the interpreter versions found. Do not silently substitute shape checks for YAML validation.
