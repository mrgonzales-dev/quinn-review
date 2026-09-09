#!/usr/bin/env python3
"""API smoke tests for Quinn webapp."""

from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from main import create_app
from quinn.diff import compute_added_diff
from quinn.storage import write_report


class ApiTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.project = Path(self.tmp.name)
        pr = {
            "title": "Web Test",
            "description": "API smoke.",
            "branch": "ai-proposal/web-test",
            "label": "test",
            "files": [
                {
                    "path": "src/a.ts",
                    "status": "added",
                    "additions": 1,
                    "deletions": 0,
                    "explanation": "new file",
                    "diff": compute_added_diff("const a = 1;\n"),
                }
            ],
        }
        self.written = write_report(pr, str(self.project))
        self.app = create_app(str(self.project))
        self.client = self.app.test_client()

    def tearDown(self):
        self.tmp.cleanup()

    def test_health(self):
        res = self.client.get("/api/health")
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.get_json()["ok"])

    def test_list_and_get(self):
        res = self.client.get("/api/prs")
        self.assertEqual(res.status_code, 200)
        prs = res.get_json()["prs"]
        self.assertEqual(len(prs), 1)
        report_id = prs[0]["id"]

        detail = self.client.get(f"/api/prs/{report_id}")
        self.assertEqual(detail.status_code, 200)
        body = detail.get_json()
        self.assertEqual(body["title"], "Web Test")
        self.assertEqual(body["files"][0]["path"], "src/a.ts")

    def test_index_and_assets(self):
        self.assertEqual(self.client.get("/").status_code, 200)
        self.assertEqual(self.client.get("/assets/styles.css").status_code, 200)
        self.assertEqual(self.client.get("/assets/app.js").status_code, 200)

    def test_missing_report(self):
        res = self.client.get("/api/prs/does-not-exist")
        self.assertEqual(res.status_code, 404)

    def test_path_traversal_blocked(self):
        res = self.client.get("/api/prs/..%2F..%2Fetc%2Fpasswd")
        self.assertEqual(res.status_code, 404)

    def test_delete_report(self):
        res = self.client.get("/api/prs")
        report_id = res.get_json()["prs"][0]["id"]

        dele = self.client.delete(f"/api/prs/{report_id}")
        self.assertEqual(dele.status_code, 200)

        after = self.client.get("/api/prs")
        self.assertEqual(len(after.get_json()["prs"]), 0)

    def test_delete_missing_report(self):
        res = self.client.delete("/api/prs/does-not-exist")
        self.assertEqual(res.status_code, 404)


if __name__ == "__main__":
    unittest.main()
