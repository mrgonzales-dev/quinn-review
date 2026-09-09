"""Persist and list Quinn PR reports as JSON files."""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def slugify(name: str) -> str:
    slug = name.strip().lower()
    slug = re.sub(r"[^a-z0-9\s-]", "", slug)
    slug = re.sub(r"\s+", "-", slug)
    slug = re.sub(r"-+", "-", slug)
    return slug


def get_reports_dir(project_path: str | None = None) -> Path:
    base = Path(project_path) if project_path else Path.cwd()
    return (base / "reports").resolve()


def write_report(pr: dict[str, Any], project_path: str | None = None) -> dict[str, str]:
    directory = get_reports_dir(project_path)
    directory.mkdir(parents=True, exist_ok=True)

    generated_at = datetime.now(timezone.utc)
    stamp = generated_at.strftime("%Y-%m-%dT%H-%M-%S-%fZ")
    slug = slugify(pr["title"])[:60] or "report"
    filename = f"{stamp}-{slug}.json"
    filepath = directory / filename

    total_additions = sum(int(f.get("additions", 0)) for f in pr["files"])
    total_deletions = sum(int(f.get("deletions", 0)) for f in pr["files"])

    payload = {
        "id": filename.removesuffix(".json"),
        "generatedAt": generated_at.isoformat(),
        "projectPath": project_path,
        "title": pr["title"],
        "description": pr["description"],
        "branch": pr["branch"],
        "label": pr.get("label"),
        "additions": total_additions,
        "deletions": total_deletions,
        "files": pr["files"],
    }

    filepath.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return {"filename": filename, "path": str(filepath), "id": payload["id"]}


def list_reports(project_path: str | None = None) -> list[dict[str, Any]]:
    directory = get_reports_dir(project_path)
    if not directory.is_dir():
        return []

    reports: list[dict[str, Any]] = []
    for path in sorted(directory.glob("*.json"), reverse=True):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        reports.append(
            {
                "id": data.get("id") or path.stem,
                "filename": path.name,
                "title": data.get("title", path.stem),
                "description": data.get("description", ""),
                "branch": data.get("branch", ""),
                "label": data.get("label"),
                "generatedAt": data.get("generatedAt"),
                "additions": data.get("additions", 0),
                "deletions": data.get("deletions", 0),
                "fileCount": len(data.get("files") or []),
                "reviewed": data.get("reviewed", False),
            }
        )
    return reports


def find_report_path(report_id: str, project_path: str | None = None) -> Path | None:
    directory = get_reports_dir(project_path)
    candidates = [
        directory / f"{report_id}.json",
        directory / report_id,
    ]
    for path in candidates:
        if path.is_file() and path.suffix == ".json":
            return path
    for path in directory.glob("*.json"):
        if path.stem == report_id:
            return path
    return None


def read_report(report_id: str, project_path: str | None = None) -> dict[str, Any] | None:
    path = find_report_path(report_id, project_path)
    if path is None:
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None


def update_report(report_id: str, updates: dict[str, Any], project_path: str | None = None) -> dict[str, Any] | None:
    path = find_report_path(report_id, project_path)
    if path is None:
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    data.update(updates)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return data
