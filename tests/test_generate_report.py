#!/usr/bin/env python3
"""Tests for Quinn generate_report + storage."""

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from quinn.diff import compute_added_diff, compute_deleted_diff, compute_diff
from quinn.storage import get_reports_dir, list_reports, read_report, slugify, write_report
from quinn.validate import validate_file, validate_pr


class DiffTests(unittest.TestCase):
    def test_compute_diff_change(self):
        diff = compute_diff("const x = 1;\n", "const x = 2;\n")
        types = [line["type"] for line in diff]
        self.assertIn("removed", types)
        self.assertIn("added", types)

    def test_added_and_deleted(self):
        self.assertEqual(len(compute_added_diff("a\nb\n")), 2)
        self.assertEqual(len(compute_deleted_diff("a\nb\n")), 2)


class ValidateTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.project = Path(self.tmp.name)
        (self.project / "src").mkdir()
        (self.project / "src" / "main.ts").write_text("const x = 1;\nconst y = 2;\n", encoding="utf-8")

    def tearDown(self):
        self.tmp.cleanup()

    def test_edits_apply(self):
        file = {
            "path": "src/main.ts",
            "status": "modified",
            "edits": [{"search": "const x = 1;", "replace": "const x = 42;"}],
            "explanation": "Change x",
        }
        self.assertIsNone(validate_file(file, str(self.project)))
        self.assertEqual(file["additions"], 1)
        self.assertEqual(file["deletions"], 1)
        self.assertNotIn("content", file)
        self.assertNotIn("edits", file)

    def test_rejects_identical(self):
        file = {
            "path": "src/main.ts",
            "status": "modified",
            "content": "const x = 1;\nconst y = 2;\n",
            "explanation": "noop",
        }
        self.assertIn("diff is empty", validate_file(file, str(self.project)))

    def test_validate_pr(self):
        pr = {
            "title": "t",
            "description": "d",
            "branch": "b",
            "files": [
                {
                    "path": "src/new.ts",
                    "status": "added",
                    "content": "x\n",
                    "explanation": "e",
                }
            ],
        }
        self.assertIsNone(validate_pr(pr, str(self.project)))

    def test_rejects_path_traversal(self):
        file = {
            "path": "../../etc/passwd",
            "status": "added",
            "content": "x\n",
            "explanation": "e",
        }
        err = validate_file(file, str(self.project))
        self.assertIsNotNone(err)
        self.assertIn("traversal", err.lower())


class StorageTests(unittest.TestCase):
    def test_slugify(self):
        self.assertEqual(slugify("My Cool Project!"), "my-cool-project")

    def test_write_and_list(self):
        with tempfile.TemporaryDirectory() as tmp:
            project = Path(tmp)
            pr = {
                "title": "Add Feature",
                "description": "Adds a feature.",
                "branch": "ai-proposal/add-feature",
                "label": "feature",
                "files": [
                    {
                        "path": "src/a.ts",
                        "status": "added",
                        "additions": 1,
                        "deletions": 0,
                        "explanation": "new",
                        "diff": compute_added_diff("const a = 1;\n"),
                    }
                ],
            }
            result = write_report(pr, str(project))
            self.assertTrue(Path(result["path"]).is_file())
            self.assertTrue(result["filename"].endswith(".json"))

            listed = list_reports(str(project))
            self.assertEqual(len(listed), 1)
            self.assertEqual(listed[0]["title"], "Add Feature")

            loaded = read_report(result["id"], str(project))
            self.assertIsNotNone(loaded)
            self.assertEqual(loaded["branch"], "ai-proposal/add-feature")
            self.assertEqual(get_reports_dir(str(project)), (project / "reports").resolve())


class CliTests(unittest.TestCase):
    def test_cli_generates_json(self):
        with tempfile.TemporaryDirectory() as tmp:
            project = Path(tmp)
            (project / "src").mkdir()
            (project / "src" / "main.ts").write_text("const x = 1;\n", encoding="utf-8")
            payload = {
                "projectPath": str(project),
                "title": "CLI Test PR",
                "description": "Test the CLI entry point.",
                "branch": "test/cli",
                "files": [
                    {
                        "path": "src/main.ts",
                        "status": "modified",
                        "edits": [{"search": "const x = 1;", "replace": "const x = 42;"}],
                        "explanation": "Update x value",
                    }
                ],
            }
            proc = subprocess.run(
                [sys.executable, str(ROOT / "generate_report.py")],
                input=json.dumps(payload),
                text=True,
                capture_output=True,
                cwd=str(ROOT),
                check=False,
            )
            self.assertEqual(proc.returncode, 0, proc.stderr)
            out = proc.stdout.strip()
            self.assertTrue(out.endswith(".json"))
            self.assertTrue(Path(out).is_file())
            data = json.loads(Path(out).read_text(encoding="utf-8"))
            self.assertEqual(data["title"], "CLI Test PR")
            self.assertTrue(data["files"][0]["diff"])


if __name__ == "__main__":
    unittest.main()
