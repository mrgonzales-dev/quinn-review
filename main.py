#!/usr/bin/env python3
"""Quinn webapp — interactive PR review UI on port 2428.

Usage:
  python main.py
  python main.py /path/to/project
  python main.py --project /path/to/project --port 2428
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory

ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from quinn.storage import find_report_path, list_reports, read_report, update_report

WEB_DIR = ROOT / "web"
DEFAULT_PORT = 2428


def create_app(project_path: str | None) -> Flask:
    app = Flask(__name__, static_folder=None)
    app.config["PROJECT_PATH"] = project_path

    @app.get("/")
    def index():
        return send_from_directory(WEB_DIR, "index.html")

    @app.get("/assets/<path:filename>")
    def assets(filename: str):
        return send_from_directory(WEB_DIR, filename)

    @app.get("/api/health")
    def health():
        return jsonify(
            {
                "ok": True,
                "projectPath": app.config["PROJECT_PATH"],
                "port": DEFAULT_PORT,
            }
        )

    @app.get("/api/prs")
    def api_list_prs():
        return jsonify({"prs": list_reports(app.config["PROJECT_PATH"])})

    @app.get("/api/prs/<path:report_id>")
    def api_get_pr(report_id: str):
        if ".." in report_id.split("/"):
            return jsonify({"error": "Report not found"}), 404
        report = read_report(report_id, app.config["PROJECT_PATH"])
        if report is None:
            return jsonify({"error": "Report not found"}), 404
        return jsonify(report)

    @app.delete("/api/prs/<path:report_id>")
    def api_delete_pr(report_id: str):
        if ".." in report_id.split("/"):
            return jsonify({"error": "Report not found"}), 404
        path = find_report_path(report_id, app.config["PROJECT_PATH"])
        if path is None:
            return jsonify({"error": "Report not found"}), 404
        try:
            path.unlink()
        except OSError:
            return jsonify({"error": "Failed to delete report"}), 500
        return jsonify({"ok": True})

    @app.patch("/api/prs/<path:report_id>")
    def api_patch_pr(report_id: str):
        if ".." in report_id.split("/"):
            return jsonify({"error": "Report not found"}), 404
        body = request.get_json(silent=True) or {}
        updates = {}
        if "reviewed" in body:
            updates["reviewed"] = bool(body["reviewed"])
        if not updates:
            return jsonify({"error": "No valid fields to update"}), 400
        result = update_report(report_id, updates, app.config["PROJECT_PATH"])
        if result is None:
            return jsonify({"error": "Report not found"}), 404
        return jsonify(result)

    return app


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Quinn interactive PR review webapp")
    parser.add_argument(
        "project",
        nargs="?",
        default=None,
        help="Project root that contains the reports/ directory",
    )
    parser.add_argument("--project", dest="project_flag", default=None, help="Same as positional project")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help="Listen port (default 2428)")
    parser.add_argument("--host", default="127.0.0.1", help="Bind host (default 127.0.0.1)")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    project_path = args.project_flag or args.project
    if project_path:
        project_path = str(Path(project_path).resolve())

    app = create_app(project_path)
    print(f"Quinn reviewing reports for: {project_path or Path.cwd()}")
    print(f"Open http://{args.host}:{args.port}/")
    app.run(host=args.host, port=args.port, debug=False, use_reloader=False)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
