#!/usr/bin/env python3
import shutil
import subprocess
import sys
from pathlib import Path


def main() -> int:
    trivy = shutil.which("trivy")

    if not trivy:
        print("Trivy not installed; skipping local Trivy scan.")
        print("CI should enforce Trivy security scanning.")
        print("Install:")
        print("  macOS:   brew install aquasecurity/trivy/trivy")
        print("  Windows: choco install trivy  OR  scoop install trivy")
        return 0

    cmd = [trivy]

    for config_name in ("trivy.yaml", "trivy.yml"):
        if Path(config_name).is_file():
            cmd.extend(["--config", config_name])
            break

    cmd.extend([
        "fs",
        "--scanners",
        "vuln,misconfig",
        "--severity",
        "HIGH,CRITICAL",
        "--exit-code",
        "1",
        ".",
    ])

    return subprocess.call(cmd)


if __name__ == "__main__":
    sys.exit(main())
