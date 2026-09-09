"""Line-level diffs with limited context around each change."""

from __future__ import annotations

import difflib
from typing import Any


CONTEXT = 3


def compute_diff(old_content: str, new_content: str) -> list[dict[str, Any]]:
    """Return DiffLine dicts with up to CONTEXT lines around each change."""
    old_lines = old_content.splitlines() if old_content else []
    new_lines = new_content.splitlines() if new_content else []

    matcher = difflib.SequenceMatcher(a=old_lines, b=new_lines, autojunk=False)
    raw: list[dict[str, Any]] = []

    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == "equal":
            for offset, line in enumerate(old_lines[i1:i2]):
                raw.append(
                    {
                        "type": "context",
                        "oldNumber": i1 + offset + 1,
                        "newNumber": j1 + offset + 1,
                        "content": line,
                    }
                )
        elif tag == "replace":
            for offset, line in enumerate(old_lines[i1:i2]):
                raw.append(
                    {
                        "type": "removed",
                        "oldNumber": i1 + offset + 1,
                        "newNumber": None,
                        "content": line,
                    }
                )
            for offset, line in enumerate(new_lines[j1:j2]):
                raw.append(
                    {
                        "type": "added",
                        "oldNumber": None,
                        "newNumber": j1 + offset + 1,
                        "content": line,
                    }
                )
        elif tag == "delete":
            for offset, line in enumerate(old_lines[i1:i2]):
                raw.append(
                    {
                        "type": "removed",
                        "oldNumber": i1 + offset + 1,
                        "newNumber": None,
                        "content": line,
                    }
                )
        elif tag == "insert":
            for offset, line in enumerate(new_lines[j1:j2]):
                raw.append(
                    {
                        "type": "added",
                        "oldNumber": None,
                        "newNumber": j1 + offset + 1,
                        "content": line,
                    }
                )

    if not raw:
        return []

    is_change = [entry["type"] != "context" for entry in raw]
    keep = [False] * len(raw)
    for idx, changed in enumerate(is_change):
        if not changed:
            continue
        start = max(0, idx - CONTEXT)
        end = min(len(raw) - 1, idx + CONTEXT)
        for cursor in range(start, end + 1):
            keep[cursor] = True

    return [entry for entry, retained in zip(raw, keep) if retained]


def compute_added_diff(new_content: str) -> list[dict[str, Any]]:
    if not new_content:
        return []
    lines = new_content.splitlines()
    return [
        {
            "type": "added",
            "oldNumber": None,
            "newNumber": idx + 1,
            "content": line,
        }
        for idx, line in enumerate(lines)
    ]


def compute_deleted_diff(old_content: str) -> list[dict[str, Any]]:
    if not old_content:
        return []
    lines = old_content.splitlines()
    return [
        {
            "type": "removed",
            "oldNumber": idx + 1,
            "newNumber": None,
            "content": line,
        }
        for idx, line in enumerate(lines)
    ]
