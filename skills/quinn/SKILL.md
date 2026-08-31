# Quinn — AI Code Review Report Generator

## Purpose

Quinn is a skill that lets an AI agent propose code changes as **static HTML reports**. Each report shows GitHub-style diffs for the proposed changes. The reports are self-contained HTML files with inline CSS. No JavaScript. No interactivity. No HTTP server required.

The AI agent sends PR data through the CLI. Quinn computes diffs from existing files on disk and writes a report HTML file. The user opens the file in a browser to review the changes.

## Workflow

**Important: Quinn must be used BEFORE you write any code.** Do not make changes to the user's files first. Analyze the codebase, plan your changes, generate reports through Quinn, and apply code only after the user approves.

1. The user gives you a task (e.g., "add input validation to the login form").
2. You analyze the relevant files in the user's codebase.
3. Pipe PR JSON to the CLI. Quinn reads existing files from disk, computes diffs, and writes an HTML report file.
4. Tell the user to open the generated report file in their browser.
5. The user reviews the diffs and tells you which changes they approve or reject.
6. Apply only the approved changes to the user's project files. Skip rejected files.

## CLI Usage

Quinn runs as a CLI script. Pipe PR JSON to stdin. Quinn writes the report to disk and prints the full path to stdout.

```bash
echo '{"projectPath":"/path/to/project","title":"...","description":"...","branch":"...","files":[...]}' | bun run src/generate-report.ts
```

The script path is relative to the Quinn project root. The last argument is the path to the Quinn repository on your system.

**Output (stdout):** The full path to the generated report file.
**Errors (stderr):** The process exits with code 1 on error.

### Listing reports

To list existing reports for a project, use the `listReportFiles` function or check the `reports/` directory inside the project path. Reports are sorted by newest first.

### Reading a report

To read a report file, open the HTML file directly from the `reports/` directory. Each file is self-contained HTML with inline CSS.

## PR Schema

Send one PR object per CLI call. The script validates the structure and rejects invalid data with an error message.

### Format — content or edits

Each file uses either `content` (full new file text) or `edits` (search/replace pairs). Send one or the other per file, not both. Quinn reads the existing file from the project's filesystem path and computes the diff automatically.

#### Content format

Send the full new file content as a string. Use this for `added` files, `deleted` files, or full rewrites of `modified` files.

```json
{
  "projectPath": "/path/to/project",
  "title": "Short summary of the proposed changes",
  "description": "Longer explanation of what and why. What does this PR do?",
  "branch": "ai-proposal/short-branch-name",
  "label": "bugfix",
  "files": [
    {
      "path": "relative/path/to/file.ext",
      "status": "modified",
      "content": "full new file text here",
      "explanation": "Why this change was made. What it does."
    }
  ]
}
```

#### Edits format

Send search/replace pairs for `modified` files. Quinn reads the existing file from disk, applies each edit in order, then computes the diff. Use this when you only change specific parts of a file. It saves tokens.

```json
{
  "projectPath": "/path/to/project",
  "title": "Short summary of the proposed changes",
  "description": "Longer explanation of what and why. What does this PR do?",
  "branch": "ai-proposal/short-branch-name",
  "label": "bugfix",
  "files": [
    {
      "path": "relative/path/to/file.ext",
      "status": "modified",
      "edits": [
        { "search": "const port = 3000;", "replace": "const port = 2400;" },
        { "search": "app.listen(port);", "replace": "app.listen(port, () => console.log(`Listening on ${port}`));" }
      ],
      "explanation": "Why this change was made. What it does."
    }
  ]
}
```

Each `search` string must appear exactly once in the file. If it appears zero times or more than once, Quinn returns an error. Fix the search string to be more specific and resend.

For `added` files: send `content` (the new file text). Quinn marks all lines as added.
For `modified` files: send `content` (new file text) or `edits` (search/replace pairs). Quinn reads the existing file from disk and computes the diff.
For `deleted` files: send `content` (can be empty string). Quinn reads the existing file from disk and marks all lines as removed.

### Field rules

- **projectPath**: Filesystem root path for reading existing files to compute diffs.
- **title**: One line, imperative mood (e.g., "Add input validation to login form").
- **description**: 2-4 sentences. What changed, why, and any tradeoffs.
- **branch**: `ai-proposal/` prefix + short kebab-case name.
- **label**: Short tag shown as a badge in the report (e.g., "bugfix", "feature", "refactor"). Optional.
- **files**: Array of file objects. One per file you propose to change.
- **path**: Relative to the project root (the `projectPath` set in the call).
- **status**: `added` for new files, `modified` for changed files, `deleted` for removed files.
- **content**: Full new file content as a string. Use for `added` files, `deleted` files, or full rewrites.
- **edits**: Array of `{search, replace}` objects. Use for `modified` files when you only change specific parts. Each `search` must be unique in the file. Only valid with `status: "modified"`.
- **additions / deletions**: Auto-computed by the server from the diff. Do not send these.
- **explanation**: One or two sentences. Why you made this specific change to this file.

Each file must have either `content` or `edits` (not both). The script computes the diff from the existing file on disk.

## Report output

Reports are written to `{projectPath}/reports/` when `projectPath` is provided. When `projectPath` is absent, reports fall back to `reports/` in the current working directory. Each report is a self-contained HTML file with inline CSS. The filename format is `{timestamp}-{slug}.html`.

Open the report file in any browser to view the diffs. The report shows:
- PR title, branch, label, and description
- Total additions and deletions
- File cards with status badges, diff tables, and explanations

## What to tell the user

After generating a report, tell the user:

> I have prepared proposed changes for your review. Open this file in your browser:
>
> `{path printed by the CLI}`
>
> Review the diffs. Tell me which changes you approve or reject. I will apply only the approved changes.

## Guidelines

- Only include files that have actual changes. Do not list unchanged files.
- Keep diffs focused. Show enough context lines (2-3 around changes) so the user understands the surrounding code.
- Write clear explanations. The user should understand *why* without reading the diff.
- Do not write code to the user's project files. Generate reports via the CLI. Apply code only after the user approves.
- Group related changes into one PR. One PR per goal or feature, not one PR per file or per fix. If multiple fixes target the same subsystem, put them in one PR. A PR can have multiple file changes as long as they share the same goal or idea. Only split into separate PRs when changes are unrelated.

## Communication Standard — ASD-STE100

All AI-generated text (chat, reports, code comments, documentation, explanations) must obey ASD-STE100 Simplified Technical English rules:

- **Approved words only.** Use the STE100 approved-word list. Do not use synonyms — one word has one meaning (e.g., use "start" not "commence", "show" not "display" unless "display" is the approved verb).
- **IT and computer jargon is permitted.** Technical terms not in the STE100 word list (e.g., "database", "endpoint", "middleware", "trait", "Blade", "PHPUnit", "refactor", "deployment") are allowed and treated as approved nouns/verbs within their domain.
- **Maximum 20 words per sentence.** Break long sentences into two or more.
- **One topic per sentence.** Do not combine unrelated ideas.
- **Active voice only.** Do not use passive voice (e.g., write "the function returns a value" not "a value is returned by the function").
- **Imperative mood for instructions and procedures.** (e.g., "Write test" not "write test".)
- **Present tense for facts and descriptions.** Do not use past tense for procedures.
- **Articles before nouns.** Use "the", "a", or "an" before nouns where applicable.
- **No -ing verb forms for instructions.** (e.g., "Remove file" not "Removing file".)
- **Short words over long words.** If two words mean same thing, use shorter one.
- **No hidden verbs.** (e.g., write "decide" not "make decision", "test" not "perform test".)
- **No redundant pairs.** (e.g., not "each", not "first and foremost".)

## Code Review Preferences

- **Be brutal and thorough.** Double-check code changes, especially when modifying existing patterns. Look for hidden complexity before making changes, not after. When in doubt, ask and confirm.
- **Review all connected files first.** Before planning any change, read every file that touches or depends on code you are about to modify. Trace function calls, trait usage, blade includes, service injections, and shared state. Do not plan change until you have read and understood full chain of affected files.
- **Double-check all connected files after planning.** Once you have plan, re-read connected files to confirm plan does not break existing calculations, return structures, side effects, or assumptions made by callers. If connected file relies on behavior you are about to change, flag it before proceeding.

## Explanation and Reporting

- **Always use behavior table.** When explaining or reporting on code, logic, calculations, or comparisons, present information in table format with columns for behavior, condition, and result. Do not use long paragraphs where table communicates same information more clearly.
- **Always include technical explanation and layman explanation.** Every report or explanation must have both. Technical explanation describes code, logic, and data flow. Layman explanation describes what it means in plain language without jargon.
- **Always end with summary.** At end of both technical section and layman section, add line that starts with "Summary:" and summarizes point. This line must stand alone and make sense without reading rest of section.
