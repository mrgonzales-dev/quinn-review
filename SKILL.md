---
name: quinn-reporter
description: >-
  Propose code changes as interactive JSON PR reports via Quinn. Use when the
  user asks to propose, preview, or review changes with Quinn, generate a
  report, or open the Quinn review webapp before applying code.
disable-model-invocation: true
---

# Quinn — Interactive PR Report Generator

## Purpose

Quinn lets an agent propose code changes as **JSON reports** reviewed in a local webapp. The CLI computes diffs from files on disk and writes JSON. The webapp on port **2428** renders those reports with interactive diffs.

Do not write HTML reports. Write JSON. Open the webapp for review.

## Workflow

**Important: Use Quinn BEFORE you write any code.** Do not change the user's project files first. Analyze, plan, generate reports, then apply only approved changes.

1. Analyze the relevant files in the user's codebase.
2. Pipe PR JSON to `generate_report.py`.
3. Start (or reuse) the webapp: `python main.py <projectPath>`.
4. Tell the user to open `http://127.0.0.1:2428/` and review the proposal.
5. Apply only the approved changes. Skip rejected files.

## CLI Usage

Run from the Quinn skill root (this directory).

```bash
echo '{"projectPath":"/path/to/project","title":"...","description":"...","branch":"...","files":[...]}' | python generate_report.py
```

**Stdout:** Absolute path to the generated `.json` report.  
**Errors:** Written to stderr; exit code 1.

### Webapp

```bash
python main.py /path/to/project
```

Opens on `http://127.0.0.1:2428/`. Serves all JSON reports under `<projectPath>/reports/`.

If the server is already running for that project, skip restarting it. Generate a new report, then tell the user to click **Refresh** (or reload).

## PR Schema

Send one PR object per CLI call. Each file uses either `content` (full new text) or `edits` (search/replace). Not both.

### Content format

```json
{
  "projectPath": "/path/to/project",
  "title": "Add input validation to login form",
  "description": "What changed and why.",
  "branch": "ai-proposal/short-branch-name",
  "label": "bugfix",
  "files": [
    {
      "path": "relative/path/to/file.ext",
      "status": "modified",
      "content": "full new file text here",
      "explanation": "Why this file changed."
    }
  ]
}
```

### Edits format

Prefer `edits` for partial changes (saves tokens). Each `search` must appear exactly once.

```json
{
  "projectPath": "/path/to/project",
  "title": "Add input validation to login form",
  "description": "What changed and why.",
  "branch": "ai-proposal/short-branch-name",
  "label": "bugfix",
  "files": [
    {
      "path": "relative/path/to/file.ext",
      "status": "modified",
      "edits": [
        { "search": "const port = 3000;", "replace": "const port = 2400;" }
      ],
      "explanation": "Why this file changed."
    }
  ]
}
```

### Status rules

- **added**: send `content` (new file text)
- **modified**: send `content` or `edits`
- **deleted**: send `content` (may be `""`); Quinn reads the file from disk

### Field rules

- **projectPath**: Project root used to read existing files and write `reports/`
- **title**: One line, imperative mood
- **description**: 2–4 sentences
- **branch**: `ai-proposal/` + kebab-case name
- **label**: Optional badge (`bugfix`, `feature`, `refactor`)
- **path**: Relative to `projectPath`
- **explanation**: One or two sentences per file
- Do not send `additions`, `deletions`, or `diff` — the CLI computes them

## Report output

Reports land in `<projectPath>/reports/` as `{timestamp}-{slug}.json`. When `projectPath` is absent, they fall back to `./reports` under the current working directory.

## What to tell the user

> I prepared proposed changes for review in Quinn.
>
> Open http://127.0.0.1:2428/
>
> Review the diffs. Tell me which changes you approve or reject. I will apply only the approved changes.

If the webapp is not running yet, start it first, then send that message.

## Guidelines

- Only include files that actually change
- Group related changes into one PR (one goal per PR)
- Do not write code to the user's project until they approve
- Prefer `edits` over full `content` for small modifications
