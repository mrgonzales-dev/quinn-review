# Quinn

**Quinn turns AI code proposals into review reports you can understand.**

When an AI agent suggests changes to your code, you want to see exactly what it plans to do before anything gets written. Quinn makes that possible. It takes proposed changes and renders them as self-contained HTML diff reports. You open the report in your browser, review the diffs, approve or reject each file, and only the approved changes get applied.

No surprises. No blind trust. Just clear, visual review.

---

## How it works

1. You give the AI a task — anything from "fix the login bug" to "add dark mode."
2. The AI reads your code and figures out what needs to change.
3. The AI pipes PR JSON to Quinn's CLI. Quinn computes diffs from your existing files on disk and writes a static HTML report.
4. You open the generated report file in your browser.
5. Each file shows a color-coded diff — green for additions, red for deletions.
6. You tell the AI which changes you approve or reject.
7. The AI applies only what you approved.

You stay in control the entire time. Nothing gets written to your project until you say yes.

---

## What you see

- **PR header** — Title, branch name, label badge, and description.
- **Summary stats** — Total additions and deletions across all files.
- **File cards** — Each file shows its status (added, modified, deleted), path, line stats, and a color-coded diff table.
- **File explanations** — Each file includes a short note explaining why the change was made.
- **Dark theme** — Easy on the eyes. GitHub-inspired colors throughout.

---

## Getting started

### Prerequisites

You need [Bun](https://bun.sh) installed. If you don't have it:

```bash
curl -fsSL https://bun.sh/install | bash
```

### Install

Clone the repository:

```bash
git clone https://github.com/mrgonzales-dev/quinn-review.git
cd quinn-review
```

### Run the CLI

Quinn runs as a CLI script. Pipe PR JSON to stdin. Quinn writes the report to disk and prints the full path to stdout.

```bash
echo '{"projectPath":"/path/to/project","title":"...","description":"...","branch":"...","files":[...]}' | bun run src/generate-report.ts
```

Reports are written to `{projectPath}/reports/` when a project path is provided, or `reports/` in the current working directory otherwise. Each report is a self-contained HTML file with inline CSS. No JavaScript. No interactivity. No internet connection required.

### Update

```bash
git pull origin main
```

---

## CLI

Quinn exposes one CLI script:

| Command | Purpose |
|---|---|
| `bun run src/generate-report.ts` | Read PR JSON from stdin, compute diffs from existing files on disk, write a static HTML report, and print the report path to stdout. Errors go to stderr with exit code 1. |

### File formats

Each file in a PR uses either `content` (full new file text) or `edits` (search/replace pairs):

- **`content`** — Send the full new file content. Use for added files, deleted files, or full rewrites.
- **`edits`** — Send search/replace pairs for modified files. Quinn reads the existing file from disk, applies each edit in order, then computes the diff. Each `search` string must appear exactly once in the file.

---

## Using Quinn with an AI agent

Quinn works with any AI coding agent that can run shell commands. The agent follows this flow:

1. Analyze your codebase and plan changes.
2. Pipe PR JSON to `bun run src/generate-report.ts` with the proposed changes and your project path.
3. Tell you to open the generated report file in your browser.
4. Wait for your review decisions.
5. Apply only the approved changes.

The agent handles all the technical work. You just review and decide.

---

## Project structure

```
quinn-review/
├── src/
│   ├── generate-report.ts     # CLI entry point (stdin → report → stdout)
│   ├── diff.ts                # LCS-based line diff computation
│   ├── types.ts               # TypeScript types
│   ├── styles.ts              # All CSS styles (inline in reports)
│   ├── escape.ts              # HTML escaping utility
│   ├── render/
│   │   ├── render-report.ts   # Full HTML report renderer
│   │   └── render-diff.ts     # Diff table renderer
├── skills/quinn/SKILL.md      # Full skill documentation for AI agents
├── AGENTS.md                  # Agent behavior rules
├── plugin.json                # Agent auto-discovery manifest
└── test/generate-report.test.ts  # Test suite
```

---

## Why Quinn?

Code review exists for a reason. When someone proposes changes, you want to see them before they land. AI agents are no different. Quinn brings that same review workflow to AI-generated code.

Instead of trusting the AI to make changes directly, you get a visual checkpoint. You catch mistakes. You reject bad ideas. You approve the good stuff. The AI becomes a collaborator, not a loose cannon.

---

## License

MIT
