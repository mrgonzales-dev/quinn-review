# Quinn — AI Code Review Skill

## Purpose

Quinn is a skill that lets an AI agent propose code changes as a **GitHub-style Pull Request page** rendered in a local browser. The human reviews the proposed changes before any code is written. The AI does not write code automatically.

## Workflow

1. The user gives you a task (e.g., "add input validation to the login form").
2. You analyze the relevant files in the user's codebase.
3. Start the review server: `bun run server.ts`.
4. Clear any existing PRs: `DELETE http://localhost:2400/api/prs`.
5. Send each PR one at a time via `POST http://localhost:2400/api/pr`. The server validates the data and appends it.
6. Tell the user to open `http://localhost:2400` in their browser.
7. The user reviews the diffs. They approve, reject, or copy the code to apply it themselves.
8. Read `reviews.json` to see which files the user approved or rejected.
9. Apply only the approved changes to the user's project files.

## PR Schema

Send one PR object per `POST /api/pr` call. The server validates the structure and rejects invalid data with an error message.

```json
{
  "title": "Short summary of the proposed changes",
  "description": "Longer explanation of what and why. What does this PR do?",
  "branch": "ai-proposal/short-branch-name",
  "files": [
    {
      "path": "relative/path/to/file.ext",
      "status": "added | modified | deleted",
      "additions": 12,
      "deletions": 3,
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
- **files**: Array of file objects. One per file you propose to change.
- **path**: Relative to the user's project root.
- **status**: `added` for new files, `modified` for changed files, `deleted` for removed files.
- **additions / deletions**: Count of added and removed lines.
- **diff**: Array of line objects in order.
  - `type`: `context` (unchanged), `added` (new line), `removed` (deleted line).
  - `oldNumber`: Line number in the original file. `null` for added lines.
  - `newNumber`: Line number in the new file. `null` for removed lines.
  - `content`: The raw line content (no leading +/- sign).
- **explanation**: One or two sentences. Why you made this specific change to this file.

## Starting the review server

Run:

```bash
bun run server.ts
```

This starts a local server at `http://localhost:2400`. It serves the review page and provides API endpoints for PR management and review decisions.

If Bun is not installed, install it first:

```bash
curl -fsSL https://bun.sh/install | bash
```

## API Endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/health` | GET | Health check. Returns PR count and review count. |
| `/api/pr` | POST | Add one PR. Server validates and appends to the data file. |
| `/api/prs` | GET | Return all current PRs. |
| `/api/prs` | DELETE | Clear all PRs. |
| `/api/pr/:index` | GET | Return one PR by index. |
| `/api/pr/:index` | DELETE | Remove one PR by index. |
| `/api/review` | POST | Save a review decision. Body: `{"idSuffix": "0-0", "action": "approved"}`. |
| `/api/review/:idSuffix` | DELETE | Remove one review decision by idSuffix. |
| `/api/reviews` | GET | Return all saved review decisions. |

### Sending a PR

```bash
curl -X POST http://localhost:2400/api/pr \
  -H "Content-Type: application/json" \
  -d '{"title":"...","description":"...","branch":"...","files":[...]}'
```

The server validates the PR structure. It checks that:
- All required fields exist and have correct types.
- `additions` and `deletions` counts match the actual added and removed lines in the diff.
- `status` is one of `added`, `modified`, or `deleted`.
- `type` in each diff line is `context`, `added`, or `removed`.
- `oldNumber` is `null` for added lines. `newNumber` is `null` for removed lines.
- No duplicate file paths within the same PR.
- `idSuffix` in review POST must match the format `{prIndex}-{fileIndex}`.

If validation fails, the server returns a 400 response with an error message. Fix the error and send the PR again.

## What to tell the user

After starting the server, tell the user:

> I've prepared proposed changes for your review. Open this URL in your browser:
>
> `http://localhost:2400`
>
> Review the diffs. You can approve, reject, or copy the code to apply it yourself. Your decisions save automatically. Let me know what you'd like to change.

## Reading review decisions

After the user reviews, read `reviews.json` in the skill directory. It contains a map of file IDs to review actions:

```json
{
  "0-0": "approved",
  "0-1": "rejected",
  "1-0": "approved"
}
```

The key format is `{prIndex}-{fileIndex}`. Only apply changes for files marked `"approved"`. Do not apply changes for files marked `"rejected"`. If a file is not in the file, the user has not reviewed it yet. Ask the user to review the remaining files.

## Guidelines

- Only include files that have actual changes. Do not list unchanged files.
- Keep diffs focused. Show enough context lines (2-3 around changes) so the user understands the surrounding code.
- Write clear explanations. The user should understand *why* without reading the diff.
- Do not write code to the user's project files. Send PRs via the API. Apply code only after the user approves.
- If the task is large, split it into multiple PRs. Send each PR as a separate `POST /api/pr` call.
- The `additions` and `deletions` counts must match the actual number of `added` and `removed` lines in the diff array. The server rejects PRs where these do not match.

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
