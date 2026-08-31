# Quinn

**Quinn turns AI code proposals into review reports you can understand.**

When an AI agent suggests changes to your code, you want to see exactly what it plans to do before anything gets written. Quinn makes that possible. It takes proposed changes and renders them as self-contained HTML diff reports. You open the report in your browser, review the diffs, approve or reject each file, and only the approved changes get applied.

No surprises. No blind trust. Just clear, visual review.

---

## How it works

1. You give the AI a task — anything from "fix the login bug" to "add dark mode."
2. The AI reads your code and figures out what needs to change.
3. The AI calls Quinn's MCP tools with the proposed changes. Quinn computes diffs from your existing files on disk and writes a static HTML report.
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

Clone the repository and install dependencies:

```bash
git clone https://github.com/mrgonzales-dev/quinn-review.git
cd quinn-review
bun install
```

### Run the MCP server

Quinn runs as an MCP server using stdio transport. No HTTP server. No port to open. The AI agent communicates with Quinn through the Model Context Protocol.

```bash
bun run src/mcp-server.ts
```

Reports are written to `{projectPath}/reports/` when a project path is provided, or `reports/` in the current working directory otherwise. Each report is a self-contained HTML file with inline CSS. No JavaScript. No interactivity. No internet connection required.

### Update

```bash
git pull origin main
```

---

## MCP tools

Quinn exposes three tools via the Model Context Protocol:

| Tool | Purpose |
|---|---|
| `quinn_generate_report` | Generate a static HTML report from PR data. Pass `projectPath`, `title`, `description`, `branch`, `files`, and optional `label`. Computes diffs from existing files on disk. Returns the filename and path of the generated report. |
| `quinn_list_reports` | List all generated HTML reports. Pass `projectPath` to list reports for a specific project. Returns filenames sorted by newest first. |
| `quinn_get_report` | Read the full HTML content of a generated report by filename. Pass `projectPath` to read from a specific project's reports directory. |

### File formats

Each file in a PR uses either `content` (full new file text) or `edits` (search/replace pairs):

- **`content`** — Send the full new file content. Use for added files, deleted files, or full rewrites.
- **`edits`** — Send search/replace pairs for modified files. Quinn reads the existing file from disk, applies each edit in order, then computes the diff. Each `search` string must appear exactly once in the file.

---

## Using Quinn with an AI agent

Quinn works with any AI coding agent that supports the Model Context Protocol. The agent follows this flow:

1. Analyze your codebase and plan changes.
2. Call `quinn_generate_report` with the proposed changes and your project path.
3. Tell you to open the generated report file in your browser.
4. Wait for your review decisions.
5. Apply only the approved changes.

The agent handles all the technical work. You just review and decide.

---

## Project structure

```
quinn-review/
├── src/
│   ├── mcp-server.ts          # MCP server with stdio transport
│   ├── diff.ts                # LCS-based line diff computation
│   ├── types.ts               # TypeScript types
│   ├── styles.ts              # All CSS styles (inline in reports)
│   ├── escape.ts              # HTML escaping utility
│   ├── render/
│   │   ├── render-report.ts   # Full HTML report renderer
│   │   └── render-diff.ts     # Diff table renderer
│   └── assets/                # Logo and images
├── skills/quinn/SKILL.md      # Full skill documentation for AI agents
├── AGENTS.md                  # Agent behavior rules
├── plugin.json                # Agent auto-discovery manifest
├── .mcp.json                  # MCP server config
├── package.json               # Project metadata
└── test/mcp.test.ts           # Test suite
```

---

## Why Quinn?

Code review exists for a reason. When someone proposes changes, you want to see them before they land. AI agents are no different. Quinn brings that same review workflow to AI-generated code.

Instead of trusting the AI to make changes directly, you get a visual checkpoint. You catch mistakes. You reject bad ideas. You approve the good stuff. The AI becomes a collaborator, not a loose cannon.

---

## License

MIT
