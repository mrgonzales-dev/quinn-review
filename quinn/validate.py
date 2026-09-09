"""Validate PR JSON and compute diffs from disk."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from quinn.diff import compute_added_diff, compute_deleted_diff, compute_diff


def read_old_file(project_path: str | None, file_path: str) -> str:
    if not project_path:
        return ""
    abs_path = Path(project_path) / file_path
    if not abs_path.is_file():
        return ""
    try:
        return abs_path.read_text(encoding="utf-8")
    except OSError:
        return ""


def validate_file(file: Any, project_path: str | None = None) -> str | None:
    if not isinstance(file, dict):
        return "File must be an object"

    path = file.get("path")
    if not isinstance(path, str) or not path:
        return "File path must be a non-empty string"

    if ".." in Path(path).parts:
        return "File path contains directory traversal"

    status = file.get("status")
    if status not in {"added", "modified", "deleted"}:
        return "File status must be 'added', 'modified', or 'deleted'"

    explanation = file.get("explanation")
    if not isinstance(explanation, str) or not explanation:
        return "File explanation must be a non-empty string"

    has_content = isinstance(file.get("content"), str)
    has_edits = isinstance(file.get("edits"), list)

    if not has_content and not has_edits:
        return "File must have a 'content' string or an 'edits' array"
    if has_content and has_edits:
        return "File must have 'content' or 'edits', not both"

    if has_edits:
        if status == "added":
            return "Cannot use 'edits' with status 'added' — use 'content' instead"
        if status == "deleted":
            return "Cannot use 'edits' with status 'deleted' — use 'content' instead"

        old_content = read_old_file(project_path, path)
        if not old_content:
            return f"Cannot apply edits to '{path}': file does not exist in project directory"

        content = old_content
        for index, edit in enumerate(file["edits"]):
            if not isinstance(edit, dict):
                return f"Edit {index}: must be an object"
            search = edit.get("search")
            replace = edit.get("replace")
            if not isinstance(search, str) or not isinstance(replace, str):
                return f"Edit {index}: 'search' and 'replace' must be strings"
            occurrences = content.count(search)
            if occurrences == 0:
                return f"Edit {index}: search string not found in '{path}'"
            if occurrences > 1:
                return (
                    f"Edit {index}: search string found {occurrences} times "
                    f"in '{path}' — must be unique"
                )
            content = content.replace(search, replace, 1)

        file["content"] = content
    else:
        content = file["content"]

    if status == "added":
        file["diff"] = compute_added_diff(content)
    elif status == "deleted":
        old_content = read_old_file(project_path, path)
        if not old_content:
            return f"Cannot delete '{path}': file does not exist in project directory"
        file["diff"] = compute_deleted_diff(old_content)
    else:
        old_content = read_old_file(project_path, path)
        if not old_content:
            file["status"] = "added"
            file["diff"] = compute_added_diff(content)
        else:
            file["diff"] = compute_diff(old_content, content)

    if not file["diff"]:
        return "Computed diff is empty — content is identical to existing file"

    file["additions"] = sum(1 for line in file["diff"] if line["type"] == "added")
    file["deletions"] = sum(1 for line in file["diff"] if line["type"] == "removed")

    # Drop raw content from stored report payload — diff is enough for the UI.
    file.pop("content", None)
    file.pop("edits", None)
    return None


def validate_pr(pr: Any, project_path: str | None = None) -> str | None:
    if not isinstance(pr, dict):
        return "PR must be an object"

    if not isinstance(pr.get("title"), str) or not pr["title"]:
        return "PR title must be a non-empty string"
    if not isinstance(pr.get("description"), str) or not pr["description"]:
        return "PR description must be a non-empty string"
    if not isinstance(pr.get("branch"), str) or not pr["branch"]:
        return "PR branch must be a non-empty string"
    if pr.get("label") is not None and not isinstance(pr.get("label"), str):
        return "PR label must be a string"

    files = pr.get("files")
    if not isinstance(files, list) or not files:
        return "PR files must be a non-empty array"

    for index, file in enumerate(files):
        err = validate_file(file, project_path)
        if err:
            path = file.get("path") if isinstance(file, dict) else "unknown"
            return f"File {index} ({path}): {err}"

    seen: set[str] = set()
    for file in files:
        path = file["path"]
        if path in seen:
            return f"Duplicate file path: {path}"
        seen.add(path)

    return None
