#!/usr/bin/env python3
"""Quinn CLI — read PR JSON from stdin, write a JSON report file.

Usage:
  echo '{"projectPath":"...","title":"...","files":[...]}' | python generate_report.py

Stdout: absolute path to the generated report JSON.
Stderr + exit 1 on error.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

# Allow running from repo root without installing a package.
ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from quinn.storage import write_report
from quinn.validate import validate_pr


def main() -> int:
    stdin = sys.stdin.read()
    if not stdin.strip():
        sys.stderr.write("No input provided. Pipe PR JSON to stdin.\n")
        return 1

    try:
        pr = json.loads(stdin)
    except json.JSONDecodeError:
        sys.stderr.write("Invalid JSON input.\n")
        return 1

    if not isinstance(pr, dict):
        sys.stderr.write("Validation error: PR must be an object\n")
        return 1

    project_path = pr.get("projectPath")
    if project_path is not None and not isinstance(project_path, str):
        sys.stderr.write("Validation error: projectPath must be a string\n")
        return 1

    err = validate_pr(pr, project_path)
    if err:
        sys.stderr.write(f"Validation error: {err}\n")
        return 1

    result = write_report(pr, project_path)
    sys.stdout.write(f"{result['path']}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
