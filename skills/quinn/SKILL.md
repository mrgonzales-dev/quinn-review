# Quinn — AI Code Review Skill

## Purpose

Quinn is a skill that lets an AI agent propose code changes as a **GitHub-style Pull Request page** rendered in a local browser. The human reviews the proposed changes before any code is written. The AI does not write code automatically.

Quinn supports **multiple projects**. Each project is a separate folder with its own PRs and reviews. Projects appear as themed icons on the landing page. The user clicks a folder to review that project's PRs.

## Workflow

**Important: Quinn must be used BEFORE you write any code.** Do not make changes to the user's files first and then send them for review. Analyze the codebase, plan your changes, send PRs through Quinn, and apply code only after the user approves.

1. The user gives you a task (e.g., "add input validation to the login form").
2. You analyze the relevant files in the user's codebase.
3. Start the review server: `bun run server.ts`.
4. Call `quinn_list_projects` to see existing projects. If none exist or you need a new one, call `quinn_create_project` with a name and optional theme (blue, green, purple, orange, red, teal).
5. Call `quinn_clear` with the `projectId` to reset any old PRs in the project.
6. Send each PR one at a time via `quinn_send_pr` (pass `projectId`), or send up to 5 at once via `quinn_send_batch`. The server validates the data and appends each PR.
7. Tell the user to open `http://localhost:2400` in their browser and click the project folder.
8. The user reviews the diffs. They approve, reject, or copy the code to apply it themselves.
9. Call `quinn_list_prs` with the `projectId` to see per-file review verdicts (approved/rejected/pending).
10. Apply only the approved changes to the user's project files. Skip rejected files.

## PR Schema

Send one PR object per `quinn_send_pr` call or in the `prs` array of `quinn_send_batch`. The server validates the structure and rejects invalid data with an error message.

### Preferred format — content-based (saves tokens)

Send the full file content as a string. The server computes the diff automatically. This avoids writing per-line JSON diff objects.

```json
{
  "title": "Short summary of the proposed changes",
  "description": "Longer explanation of what and why. What does this PR do?",
  "branch": "ai-proposal/short-branch-name",
  "label": "bugfix",
  "files": [
    {
      "path": "relative/path/to/file.ext",
      "status": "modified",
      "content": "full new file text here",
      "oldContent": "full old file text here",
      "explanation": "Why this change was made. What it does."
    }
  ]
}
```

For `added` files: send only `content` (the new file text).
For `modified` files: send both `content` (new) and `oldContent` (original).
For `deleted` files: send `content` or `oldContent` with the file text being removed.

### Alternative format — diff-based

Send a `diff` array with line-by-line objects. Use this only when you need precise control over which lines appear in the review.

```json
{
  "title": "Short summary of the proposed changes",
  "description": "Longer explanation of what and why. What does this PR do?",
  "branch": "ai-proposal/short-branch-name",
  "label": "bugfix",
  "files": [
    {
      "path": "relative/path/to/file.ext",
      "status": "added | modified | deleted",
      "diff": [
        {
          "type": "context | added | removed",
          "oldNumber": 10,
          "newNumber": 10,
          "content": "the line of code"
        }
      ],
      "explanation": "Why this change was made. What it does."
    }
  ]
}
```

You can send one PR or multiple PRs. Each PR appears as a separate entry in the sidebar.

### Field rules

- **title**: One line, imperative mood (e.g., "Add input validation to login form").
- **description**: 2-4 sentences. What changed, why, and any tradeoffs.
- **branch**: `ai-proposal/` prefix + short kebab-case name.
- **label**: Short tag shown as a badge in the sidebar (e.g., "bugfix", "feature", "refactor"). Optional.
- **files**: Array of file objects. One per file you propose to change.
- **path**: Relative to the user's project root.
- **status**: `added` for new files, `modified` for changed files, `deleted` for removed files.
- **content**: Full new file content as a string. Server computes the diff. Preferred over `diff`.
- **oldContent**: Original file content. Used with `content` for `modified` status.
- **additions / deletions**: Optional. The server auto-computes these from the diff.
- **diff**: Array of line objects in order. Alternative to `content`.
  - `type`: `context` (unchanged), `added` (new line), `removed` (deleted line).
  - `oldNumber`: Line number in the original file. `null` for added lines.
  - `newNumber`: Line number in the new file. `null` for removed lines.
  - `content`: The raw line content (no leading +/- sign).
- **explanation**: One or two sentences. Why you made this specific change to this file.

Each file must have either `content` or `diff` (not neither). If both are present, `content` takes precedence.

## Starting the review server

Run:

```bash
bun run server.ts
```

This starts a local server at `http://localhost:2400`. It serves the review page and provides API endpoints for project management, PR management, and review decisions.

If Bun is not installed, install it first:

```bash
curl -fsSL https://bun.sh/install | bash
```

## MCP Tools

Quinn exposes these tools via the Model Context Protocol. All PR and review tools require a `projectId` parameter.

| Tool | Purpose |
|---|---|
| `quinn_start` | Check if the review server is running. Returns health status including project count. |
| `quinn_create_project` | Create a new project folder. Pass `name` and optional `theme` (blue, green, purple, orange, red, teal). Returns the project ID. |
| `quinn_list_projects` | List all projects. Returns id, name, theme, and PR count for each. |
| `quinn_send_pr` | Send one PR for review. Pass `projectId`, `title`, `description`, `branch`, `files`, and optional `label`. |
| `quinn_send_batch` | Send up to 5 PRs at once. Pass `projectId` and `prs` array. |
| `quinn_list_prs` | List all PRs in a project with per-file review verdicts and comments. |
| `quinn_get_pr` | Get full content of one PR by index. Pass `projectId` and `prIndex`. |
| `quinn_update_pr` | Update an existing PR by index. Clears old reviews and resets completed status. |
| `quinn_delete_pr` | Delete one PR by index. Shifts subsequent PR indices down by one. |
| `quinn_reviews` | Get all review decisions for a project. Returns a map of file IDs to verdicts. |
| `quinn_clear` | Delete all PRs and reviews in a project. |

## API Endpoints

All PR and review endpoints are project-scoped under `/api/project/:id/`.

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/health` | GET | Health check. Returns project count. |
| `/api/settings` | GET | Return settings (firstTimeSeen flag). |
| `/api/settings` | POST | Update settings. Body: `{"firstTimeSeen": true}`. |
| `/api/projects` | GET | List all projects with id, name, theme, and PR count. |
| `/api/project` | POST | Create a project. Body: `{"name": "...", "theme": "blue"}`. Returns the project ID. |
| `/api/project/:id` | GET | Return one project with PRs and reviews. |
| `/api/project/:id` | DELETE | Delete a project and all its PRs and reviews. |
| `/api/project/:id/pr` | POST | Add one PR to the project. Server validates and appends. |
| `/api/project/:id/prs` | GET | Return all PRs in the project. |
| `/api/project/:id/prs` | DELETE | Clear all PRs in the project. |
| `/api/project/:id/prs/batch` | POST | Add up to 5 PRs at once. Body: array of PR objects. |
| `/api/project/:id/pr/:index` | GET | Return one PR by index. |
| `/api/project/:id/pr/:index` | PUT | Update one PR by index. Clears reviews for that PR. |
| `/api/project/:id/pr/:index` | DELETE | Remove one PR by index. |
| `/api/project/:id/review` | POST | Save a review decision. Body: `{"idSuffix": "0-0", "action": "approved", "comment": "..."}`. |
| `/api/project/:id/review/:idSuffix` | DELETE | Remove one review decision by idSuffix. |
| `/api/project/:id/reviews` | GET | Return all saved review decisions for the project. |
| `/api/project/:id/complete` | GET | Return completed PR indices. |
| `/api/project/:id/complete/:prIndex` | POST | Mark a PR as completed. |

### Sending a PR

```bash
curl -X POST http://localhost:2400/api/project/my-app/pr \
  -H "Content-Type: application/json" \
  -d '{"title":"...","description":"...","branch":"...","files":[...]}'
```

The server validates the PR structure. It checks that:
- All required fields exist and have correct types.
- `additions` and `deletions` counts (if provided) match the actual added and removed lines in the diff.
- `status` is one of `added`, `modified`, or `deleted`.
- `type` in each diff line is `context`, `added`, or `removed`.
- `oldNumber` is `null` for added lines. `newNumber` is `null` for removed lines.
- No duplicate file paths within the same PR.
- `idSuffix` in review POST must match the format `{prIndex}-{fileIndex}`.

If validation fails, the server returns a 400 response with an error message. Fix the error and send the PR again.

## What to tell the user

After starting the server and sending PRs, tell the user:

> I have prepared proposed changes for your review. Open this URL in your browser:
>
> `http://localhost:2400`
>
> Click the project folder to see the PRs. Review the diffs. You can approve, reject, or copy the code to apply it yourself. Your decisions save automatically. Let me know what you would like to change.

## Reading review decisions

After the user reviews, call `quinn_list_prs` with the `projectId`. This returns each PR with per-file verdicts:

```json
[
  {
    "index": 0,
    "label": "bugfix",
    "title": "Fix path traversal",
    "branch": "fix/path-traversal",
    "completed": false,
    "files": [
      { "path": "server.js", "verdict": "approved", "comment": null },
      { "path": "utils.js", "verdict": "rejected", "comment": "Rewrite this part" }
    ]
  }
]
```

The verdict is `approved`, `rejected`, or `pending`. Only apply changes for files marked `approved`. Do not apply changes for files marked `rejected`. If a file is `pending`, the user has not reviewed it yet. Ask the user to review the remaining files.

## Guidelines

- Only include files that have actual changes. Do not list unchanged files.
- Keep diffs focused. Show enough context lines (2-3 around changes) so the user understands the surrounding code.
- Write clear explanations. The user should understand *why* without reading the diff.
- Do not write code to the user's project files. Send PRs via the API. Apply code only after the user approves.
- Group related changes into one PR. One PR per goal or feature, not one PR per file or per fix. If multiple fixes target the same subsystem, put them in one PR. A PR can have multiple file changes as long as they share the same goal or idea. Only split into separate PRs when changes are unrelated.
- Create a new project for each distinct codebase or feature set that needs separate review.

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
- **Always end with 💡 summary.** At end of both technical section and layman section, add line that starts with 💡 and summarizes point. This line must stand alone and make sense without reading rest of section.
